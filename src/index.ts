import axios from 'axios';
import { cpSync, mkdtempSync, rmSync } from 'fs-extra';
import { tmpdir } from 'os';
import { basename, join } from 'path';

import {
  PreviewEnvironment,
  PreviewEnvironmentVersion,
} from './model';
import {
  CreatePreviewEnvironmentPayload,
  DeployToPreviewEnvironmentPayload,
  PreviewEnvironmentDeploymentStatusPayload,
} from './payload';
import {  zipDirectory } from './util';


/**
 * Calls the Zonké API to create a preview environment. Note that this function only defines the preview environment,
 * it does not deploy any code to it. To deploy code to the preview environment, use `deployToPreviewEnvironment`.
 * 
 * @returns The preview environment that was created. The versions array will always be empty.
 */
export async function createPreviewEnvironment({
  userId,
  framework,
  awsHostedZone,
}: CreatePreviewEnvironmentPayload): Promise<PreviewEnvironment> {
  const { data } = await axios.post(
    `${process.env['ZONKE_API_ENDPOINT']}/preview-environment/create`,
    {
      userId,
      framework,
      awsHostedZone,
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-zonke-api-key': process.env['ZONKE_API_KEY'],
        'x-zonke-api-token': process.env['ZONKE_API_TOKEN'],
      },
    },
  );

  return data;
}


/**
 * Uploads a build output directory to trigger a preview environment deployment. Depending on the framework, there 
 * might be post-processing steps required to build the preview environment. For example, Next.js standalone output
 * requires a post-build step to separate the serverless functions from the static assets. The initial deployment
 * might take a few minutes to complete. you can check the status of the deployment by calling `getDeploymentStatus`.
 * 
 * @returns The preview environment that was deployed to. The versions array will contain the version that was deployed.
 */
export async function deployToPreviewEnvironment({
  environmentId,
  buildOutputDirectory,
  uploadLinkExpirationOverride,
}: DeployToPreviewEnvironmentPayload): Promise<PreviewEnvironmentVersion> {
  const { data } = await axios.post(
    `${process.env['ZONKE_API_ENDPOINT']}/preview-environment/deployment-endpoint`,
    {
      environmentId,
      expiresIn: uploadLinkExpirationOverride || 60,
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-zonke-api-key': process.env['ZONKE_API_KEY'],
        'x-zonke-api-token': process.env['ZONKE_API_TOKEN'],
      },
    },
  );

  // Copy the build output directory to a temporary directory to preserve the original directory name.
  const outDirectory = mkdtempSync(join(tmpdir(), 'zip-'));
  cpSync(buildOutputDirectory, join(outDirectory, basename(buildOutputDirectory)), {
    recursive: true,
  });

  const zipFileBuffer = await zipDirectory(outDirectory);

  const { headers } = await axios.put(
    data.presignedDeploymentEndpoint,
    zipFileBuffer,
    {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': zipFileBuffer.length,
      },
    },
  );

  rmSync(outDirectory, {
    recursive: true,
  });

  return {
    isLatest: true,
    versionId: headers['x-amz-version-id'],
    // You do not need to keep this date. The `getPreviewEnvironment` will provide a more accurate date.
    lastUpdated: new Date().toISOString(),
  };
}


/**
 * Gets the preview environment with the specified ID.
 */
export async function getPreviewEnvironment(environmentId: string): Promise<PreviewEnvironment> {
  const { data } = await axios.post(
    `${process.env['ZONKE_API_ENDPOINT']}/preview-environment`,
    {
      environmentId,
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-zonke-api-key': process.env['ZONKE_API_KEY'],
        'x-zonke-api-token': process.env['ZONKE_API_TOKEN'],
      },
    },
  );

  return data;
}


/**
 * Get the status of a preview environment deployment.
 */
export async function getDeploymentStatus({
  environmentId,
  sourceVersion,
}: PreviewEnvironmentDeploymentStatusPayload): Promise<PreviewEnvironment> {
  const { data } = await axios.post(
    `${process.env['ZONKE_API_ENDPOINT']}/preview-environment/deployment-status`,
    {
      environmentId,
      sourceVersion,
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-zonke-api-key': process.env['ZONKE_API_KEY'],
        'x-zonke-api-token': process.env['ZONKE_API_TOKEN'],
      },
    },
  );

  return data;
}


/**
 * Reverts a preview environment to a previous version. A new version will be created with the same code as the
 * specified version. It is up to you to establish a relationship between the new and reverted versions.
 */
export async function revertPreviewEnvironmentToVersion({
  environmentId,
  sourceVersion,
}: PreviewEnvironmentDeploymentStatusPayload): Promise<PreviewEnvironment> {
  const { data } = await axios.post(
    `${process.env['ZONKE_API_ENDPOINT']}/preview-environment/revert`,
    {
      environmentId,
      sourceVersion,
    },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-zonke-api-key': process.env['ZONKE_API_KEY'],
        'x-zonke-api-token': process.env['ZONKE_API_TOKEN'],
      },
    },
  );

  return data;
}
