import { existsSync, readFileSync, writeFileSync } from 'fs-extra';

import {
  createPreviewEnvironment,
  deletePreviewEnvironment,
  deployToPreviewEnvironment,
  getDeploymentStatus,
  revertPreviewEnvironmentToVersion,
  PreviewEnvironmentVersion,
} from '@zonke-cloud/sdk';

import {
  API_ENDPOINT,
  CONFIG_FILE,
  ENV_FILE,
} from './constant';
import { Project } from './model';
import {
  ZonkeCredentials,
} from './payload';


let projectConfig: Project | undefined = undefined;

export async function deploy(message: string, sourceVersion: string): Promise<void> {
  exportCredentials();

  const config = getProjectConfig();
  if (!config.environment) {
    const environment = await createPreviewEnvironment(config);
    upsertConfigFile({ ...config, environment });
    config.environment = environment;
  }

  let version: PreviewEnvironmentVersion;
  if (sourceVersion !== 'latest') {
    const previousVersion = config.environment!.versions.find(({ versionId }) => versionId === sourceVersion);
    if (!previousVersion) {
      throw new Error(`The specified source version '${sourceVersion}' does not exist.`);
    }

    const status = await revertPreviewEnvironmentToVersion({
      sourceVersion,
      environmentId: config.environment!.environmentId,
    });
    if (!status) {
      throw new Error('Failed to revert to the specified source version.');
    }

    version = {
      ...previousVersion,
      versionId: status.sourceVersion,
    };

  } else {
    version = await deployToPreviewEnvironment({
      message,
      environmentId: config.environment!.environmentId,
      buildOutputDirectory: config.buildOutputDirectory,
    });
  }

  if (version) {
    config.environment!.versions = config.environment!.versions.map((version) => ({
      ...version,
      isLatest: false,
    }));
    config.environment!.versions.push(version);
    upsertConfigFile(config);
  }  
}

export async function status(): Promise<void> {
  exportCredentials();

  const config = getProjectConfig();
  if (!config.environment || !config.environment.versions.length) {
    throw new Error('No environment found. Run `npx @zonke-cloud/cli deploy` to create one.');
  }

  const sourceVersion = config.environment.versions.find((version) => version.isLatest)!.versionId;
  const { status, error } = await getDeploymentStatus({
    sourceVersion,
    environmentId: config.environment.environmentId,
  });

  if (status === 'SCHEDULED') {
    console.log('Deployment scheduled. Please wait a few minutes for the deployment to complete.');
  } else if (status === 'IN_PROGRESS') {
    console.log('Deployment in progress. Please wait a few minutes for the deployment to complete.');
  } else if (status === 'SUCCESS') {
    console.log('Deployment succeeded!');
  } else if (status === 'FAILED') {
    console.error('Deployment failed.', error);
  } else {
    console.error('Received an unknown deployment status from Zonké.', status);
  }
}

export async function deleteEnvironment(): Promise<void> {
  exportCredentials();

  const config = getProjectConfig();
  if (!config.environment) {
    console.log('No environment found. Nothing to delete.');
    return;
  }

  await deletePreviewEnvironment(config.environment.environmentId);
  upsertConfigFile({
    ...config,
    environment: undefined,
  });
}

export function upsertConfigFile({
  framework,
  environment,
  awsHostedZone,
  buildOutputDirectory,
}: Project): void {
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify({
      framework,
      environment,
      awsHostedZone,
      buildOutputDirectory,
    }, null, 2));
    writeFileSync('.gitignore', `\n${CONFIG_FILE}`, { flag: 'a' });
  } else {
    const config = JSON.parse(readFileSync(CONFIG_FILE).toString());
    writeFileSync(CONFIG_FILE, JSON.stringify({
      ...config,
      environment,
    }, null, 2));
  }
}

export async function createCredentials({
  apiKey,
  apiToken,
}: ZonkeCredentials): Promise<void> {
  writeFileSync(
    ENV_FILE,
    `ZONKE_API_KEY=${apiKey}\nZONKE_API_TOKEN=${apiToken}\nZONKE_API_ENDPOINT=${API_ENDPOINT}\n`,
  );
  writeFileSync('.gitignore', ENV_FILE, { flag: 'a' });
}

function exportCredentials(): void {
  if (!existsSync(ENV_FILE)) {
    throw new Error('Credentials file does not exist. Run `npx @zonke-cloud/cli init` to create it.');
  }

  if (!process.env['ZONKE_API_KEY'] || !process.env['ZONKE_API_TOKEN']) {
    process.loadEnvFile(ENV_FILE);
  }
}

function getProjectConfig(): Project {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error('Config file does not exist. Run `npx @zonke-cloud/cli init` to create it.');
  }

  if (!projectConfig) {
    projectConfig = JSON.parse(readFileSync(CONFIG_FILE).toString());
  }

  return projectConfig!;
}
