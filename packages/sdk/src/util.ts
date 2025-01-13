import axios from 'axios';
import { sync } from 'cross-spawn';
import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
  writeJsonSync,
} from 'fs-extra';
import JSZip from 'jszip';
import { join, relative, resolve } from 'path';

import type { PreviewEnvironmentDeploymentDirectoryMetadata } from './model';


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
    type: 'nodebuffer',
    platform: 'UNIX',
    compression: 'STORE',
  });
}


export async function deployDirectoryToS3(directory: string, deploymentEndpoint: string): Promise<string> {
  const zipFileBuffer = await zipDirectory(directory);

  const { headers } = await axios.put(
    deploymentEndpoint,
    zipFileBuffer,
    {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': zipFileBuffer.length,
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
    const packageJson = require(join(buildParentFolder, 'package.json'));
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
    hasIndexHtml: false,
    serverDirectory: serverPath,
    clientDirectory: join(buildFolder, 'client'),
  };
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
  writeFileSync(join(serverPath, 'server.mjs'), `
import serverlessExpress from '@codegenie/serverless-express';
import { createRequestHandler } from '@remix-run/express';
import compression from 'compression';
import express from 'express';
import morgan from 'morgan';


let server;

const bootstrap = async () => {
  const remixHandler = createRequestHandler({
    build: await import('./index.js'),
  });

  const app = express();
  app.use(compression());
  app.use(morgan('tiny'));
  app.disable('x-powered-by');

  app.all('*', remixHandler);

  return serverlessExpress({ 
    app,
  });
};

export const handler = async (event, context, callback) => {
  server = server ?? await bootstrap();

  return server(event, context, callback);
};
  `,
  { flag: 'w' });
}
