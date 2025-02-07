import axios from 'axios';
import { sync } from 'cross-spawn';
import {
  cpSync,
  existsSync,
  lstatSync,
  moveSync,
  readdirSync,
  readFileSync,
  readJsonSync,
  readlinkSync,
  rmSync,
  writeFileSync,
  writeJsonSync,
} from 'fs-extra';
import JSZip from 'jszip';
import { join, relative, resolve } from 'path';

import type {
  PostConfiguration,
  PreviewEnvironmentDeploymentDirectoryMetadata,
} from './model';


export function zipDirectory(directory: string): Promise<Buffer> {
  const zip = new JSZip();
  const filepaths = listDirectory(directory);

  for (const filepath of filepaths) {
    const relativePath = relative(directory, filepath);
    const stat = lstatSync(filepath);
    if (stat.isSymbolicLink()) {
      zip.file(relativePath, readlinkSync(filepath), {
        dir: stat.isDirectory(),
        unixPermissions: parseInt('120755', 8),
      });
    } else {
      zip.file(relativePath, readFileSync(filepath), {
        dir: stat.isDirectory(),
        unixPermissions: stat.mode,
      });
    }
  }

  return zip.generateAsync({
    platform: 'UNIX',
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 9,
    },
  });
}


export async function putZipToS3(zipBuffer: Buffer, endpoint: string): Promise<string> {
  const { headers } = await axios.put(endpoint, zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': zipBuffer.length,
      },
    },
  ).catch((error) => {
    throw new Error(error.response.data.message);
  });

  return headers['x-amz-version-id'];
}


export async function postZipToS3(zipBuffer: Buffer, configuration: PostConfiguration): Promise<string> {
  const postData = configuration.fields.reduce((acc, field) => {
    acc[field.key] = field.value;
    return acc;
  }, {} as Record<string, string | Buffer>);
  postData['file'] = zipBuffer;

  const { headers } = await axios.post(configuration.presignedUrl, postData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  ).catch((error) => {
    throw new Error(error.response.data.message);
  });

  return headers['x-amz-version-id'];
}


export function prepareNextJsDeployment(buildFolder: string): PreviewEnvironmentDeploymentDirectoryMetadata {
  const buildParentFolder = join(buildFolder, '..');
  cpSync(join(buildParentFolder, 'package.json'), join(buildParentFolder, 'package.json.bak'));
  try {
    const packageJson = readJsonSync(join(buildParentFolder, 'package.json'));
    packageJson.scripts = {
      'build': 'exit 0',
    };
    writeJsonSync(join(buildParentFolder, 'package.json'), packageJson, { spaces: 2 });
    
    runCommand('npx --yes open-next build', buildParentFolder, {
      ...process.env,
      NODE_ENV: 'production',
    });
  } finally {
    cpSync(join(buildParentFolder, 'package.json.bak'), join(buildParentFolder, 'package.json'));
    rmSync(join(buildParentFolder, 'package.json.bak'));
  }

  let hasIndexHtml = false;
  const clientPath = join(buildParentFolder, '.open-next', 'assets');
  const indexHtml = join(buildFolder, 'standalone', '.next', 'server', 'app', 'index.html');
  if (existsSync(indexHtml)) {
    hasIndexHtml = true;
    cpSync(indexHtml, join(clientPath, 'index.html'));
  }

  return {
    clientDirectory: clientPath,
    hasIndexHtml,
    serverDirectory: join(buildParentFolder, '.open-next', 'server-functions', 'default'),
  };
}


export function prepareDashDeployment(sourcePath: string): PreviewEnvironmentDeploymentDirectoryMetadata {
  const sourceParent = join(sourcePath, '..');
  const venvPath = resolve(join(sourceParent, '.venv-open-dash'));
  try {
    const defaultConfig = {
      'warmer': false,
      'venv-path': venvPath,
      'export-static': true,
      'source-path': sourcePath,
      'excluded-directories': [],
      'target-base-path': sourceParent,
      'fingerprint': {
        'version': true,
        'method': 'last-modified'
      }
    };

    writeFileSync(join(sourcePath, 'open-dash.config.json'), JSON.stringify(defaultConfig, null, 2));
    runCommand('python3 -m venv .venv-open-dash', sourceParent, process.env);
    runCommand(
      `${join('bin', 'pip3')} install open-dash`,
      venvPath,
      process.env,
    );
    runCommand(
      `${join(venvPath, 'bin', 'open-dash')} bundle --config-path=open-dash.config.json`,
      sourcePath,
      process.env,
    );
  } finally {
    if (existsSync(venvPath)) {
      rmSync(venvPath, { recursive: true });
    }
    
    if (existsSync(join(sourcePath, 'open-dash.config.json'))) {
      rmSync(join(sourcePath, 'open-dash.config.json'));
    }
  }

  return {
    hasIndexHtml: true,
    clientDirectory: join(sourceParent, '.open-dash', 'assets'),
  };
}


export function prepareRemixDeployment(buildFolder: string): PreviewEnvironmentDeploymentDirectoryMetadata {
  const serverPath = join(buildFolder, 'server');

  writeRemixHandler(serverPath);
  writeFileSync(join(serverPath, '.npmrc'), 'node-linker=hoisted\nsymlink=false\n', { flag: 'w' });

  runCommand(
    'npm add @remix-run/express compression express morgan @codegenie/serverless-express',
    serverPath,
    {
      ...process.env,
      NODE_ENV: 'production',
    }
  );

  return {
    serverDirectory: serverPath,
    clientDirectory: join(buildFolder, 'client'),
    hasIndexHtml: existsSync(join(buildFolder, 'client', 'index.html')),
  };
}


export function prepareVueDeployment(buildFolder: string): PreviewEnvironmentDeploymentDirectoryMetadata {
  const serverPath = join(buildFolder, 'server');

  writeVueHandler(serverPath);
  writeFileSync(join(serverPath, '.npmrc'), 'node-linker=hoisted\nsymlink=false\n', { flag: 'w' });

  runCommand(
    'npm add compression express morgan @codegenie/serverless-express',
    serverPath,
    {
      ...process.env,
      NODE_ENV: 'production',
    }
  );

  return {
    serverDirectory: serverPath,
    clientDirectory: join(buildFolder, 'client'),
    hasIndexHtml: existsSync(join(buildFolder, 'client', 'index.html')),
  };
}


export function prepareAstroDeployment(buildFolder: string): PreviewEnvironmentDeploymentDirectoryMetadata {
  // Prefer the bundled output of the custom Astro adapter when available.
  let serverPath = join(buildFolder, 'lambda');

  const metadataAdapterPath = join(buildFolder, 'zonke-adapter-metadata.json');
  if (existsSync(join(buildFolder, 'server')) && !existsSync(metadataAdapterPath)) {
    throw new Error(
      'zonke-adapter-metadata.json is missing from output directory. Is the @zonke-cloud/astro-adapter defined in your Astro config?'
    );
  }
  
  if (existsSync(serverPath)) {
    const metadata = readJsonSync(metadataAdapterPath);
    writeFileSync(join(serverPath, '.npmrc'), 'node-linker=hoisted\nsymlink=false\n', { flag: 'w' });
    writeFileSync(
      join(serverPath, 'package.json'),
      JSON.stringify({
        'type': 'commonjs',
        dependencies: metadata?.adapter?.externalPackageVersions ?? {},
      }, null, 2),
      { flag: 'w' },
    );
    runCommand('corepack enable pnpm', serverPath, {
      ...process.env,
      NODE_ENV: 'production',
    });
    runCommand(
      'pnpm add @rollup/rollup-linux-arm64-gnu',
      serverPath,
      {
        ...process.env,
        NODE_ENV: 'production',
      }
    );
  } else {
    serverPath = join(buildFolder, 'server');
    const metadata = readJsonSync(metadataAdapterPath); 

    writeFileSync(join(serverPath, '.npmrc'), 'node-linker=hoisted\nsymlink=false\n', { flag: 'w' });
    cpSync(join(metadata.astro.root, 'package.json'), join(serverPath, 'package.json'));
    runCommand('npm install', serverPath, {
      ...process.env,
      NODE_ENV: 'production',
    });
  }

  return {
    serverDirectory: serverPath,
    clientDirectory: join(buildFolder, 'client'),
    hasIndexHtml: existsSync(join(buildFolder, 'client', 'index.html')),
  };
}


export function isAstroSsrBuild(buildFolder: string): boolean {
  // dist/lambda is exported by @zonke-cloud/astro-adapter.
  return existsSync(join(buildFolder, 'lambda')) || hasClientServerFolders(buildFolder);
}


export function hasClientServerFolders(buildFolder: string): boolean {
  return existsSync(join(buildFolder, 'server')) && existsSync(join(buildFolder, 'client'));
}


function runCommand(command: string, cwd: string, env: NodeJS.ProcessEnv | undefined) {
  console.debug(`├ Running '${command}' in`, cwd);
  const commandParts = command.split(/\s+/);
  const result = sync(commandParts[0], commandParts.slice(1), {
    env,
    cwd,
    shell: true,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Command '${command}' for application failed.`);
  }
}


/**
 * Lists all file paths in a directory.
 */
function listDirectory(directory: string): string[] {
  const filepaths: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const filepath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      filepaths.push(...listDirectory(filepath));
    } else {
      filepaths.push(filepath);
    }
  }

  return filepaths;
}


/**
 * Writes the Remix server handler to the server directory.
 * 
 * TODO: Figure out a way to copy this as an asset.
 */
function writeRemixHandler(serverPath: string) {
  moveSync(join(serverPath, 'index.js'), join(serverPath, 'server.js'));
  writeFileSync(join(serverPath, 'index.mjs'), `
import serverlessExpress from '@codegenie/serverless-express';
import { createRequestHandler } from '@remix-run/express';
import compression from 'compression';
import express from 'express';
import expressPackageJson from 'express/package.json' with { type: 'json' };
import morgan from 'morgan';

import * as build from './server.js';


const expressMajorVersion = parseInt(expressPackageJson.version.split('.')[0] ?? 0);

let server;

const bootstrap = async () => {
  const app = express();
  app.use(compression());
  app.use(morgan('tiny'));
  app.disable('x-powered-by');

  const route = expressMajorVersion < 5 ? '*' : '*all';
  app.use(route, createRequestHandler({
    build,
  }));

  return serverlessExpress({ 
    app,
  });
};

export const handler = async (event, context, callback) => {
  server = server ?? await bootstrap();

  event.path ??= '/';

  return server(event, context, callback);
};
  `,
  { flag: 'w' });
}


/**
 * Writes the Vue server handler to the server directory.
 * 
 * TODO: Figure out a way to copy this as an asset.
 */
function writeVueHandler(serverPath: string) {
  writeFileSync(join(serverPath, 'index.mjs'), `
import serverlessExpress from '@codegenie/serverless-express';
import compression from 'compression';
import express from 'express';
import expressPackageJson from 'express/package.json' with { type: 'json' };
import morgan from 'morgan';

import { render } from './server.js';


const expressMajorVersion = parseInt(expressPackageJson.version.split('.')[0] ?? 0);

let server;

const bootstrap = async () => {
  const app = express();
  app.use(compression());
  app.use(morgan('tiny'));
  app.disable('x-powered-by');

  const route = expressMajorVersion < 5 ? '*' : '*all';
  app.use(route, (req, res) => {
    render(req.url)
      .then(({ html }) => {
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      })
      .catch((e) => {
        console.error(e);
        res.status(500).end(e);
      });
  });

  return serverlessExpress({ 
    app: app,
  });
};

export const handler = async (event, context, callback) => {
  server = server ?? await bootstrap();

  event.path ??= '/';

  return server(event, context, callback);
};
  `,
  { flag: 'w' });
}
