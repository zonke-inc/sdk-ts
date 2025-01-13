import axios from 'axios';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'fs-extra';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';

import type {
  PreviewEnvironment,
  PreviewEnvironmentClientProps,
  PreviewEnvironmentDeploymentDirectoryMetadata,
  PreviewEnvironmentDeploymentStatus,
  PreviewEnvironmentVersion,
} from './model';
import {
  SupportedFrameworks,
  type CreatePreviewEnvironmentPayload,
  type DeployToPreviewEnvironmentPayload,
  type PreviewEnvironmentDeploymentStatusPayload,
  type RevertPreviewEnvironmentToVersionPayload,
} from './payload';
import {
  deployDirectoryToS3,
  prepareNextJsDeployment,
  prepareRemixDeployment,
} from './util';


export class PreviewEnvironmentClient {
  private readonly apiKey: string;
  private readonly apiToken: string;
  private readonly apiEndpoint: string;

  constructor({
    apiKey,
    apiToken,
    apiEndpoint,
  }: PreviewEnvironmentClientProps) {
    this.apiKey = apiKey;
    this.apiToken = apiToken;
    this.apiEndpoint = apiEndpoint;
  }

  
  /**
   * Calls the Zonké API to create a preview environment. Note that this only defines the preview environment,
   * it does not deploy any code to it. To deploy code to the preview environment, use `deployToPreviewEnvironment`.
   * 
   * @returns The preview environment that was created. The versions array will always be empty.
   */
  async createPreviewEnvironment({
    userId,
    framework,
    awsHostedZone,
  }: CreatePreviewEnvironmentPayload): Promise<PreviewEnvironment> {
    const { data } = await axios.post(
      `${this.apiEndpoint}/preview-environment/create`,
      {
        userId,
        framework,
        awsHostedZone,
      },
      {
        headers: {
          Accept: 'application/json',
          'x-zonke-api-key': this.apiKey,
          'x-zonke-api-token': this.apiToken,
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      throw new Error(error.response.data.message);
    });

    return data;
  }


  /**
   * Uploads a build output directory to trigger a preview environment deployment. Depending on the framework, there 
   * might be post-processing steps required to build the preview environment. For example, Next.js standalone output
   * requires a post-build step to separate the serverless functions from the static assets. The initial deployment
   * might take a few minutes to complete. You can check the status of the deployment by calling `getDeploymentStatus`.
   * 
   * @returns The preview environment that was deployed to. The versions array will contain the version that was deployed.
   */
  async deployToPreviewEnvironment({
    message,
    framework,
    environmentId,
    publicDirectory,
    buildOutputDirectory,
    uploadLinkExpirationOverride,
  }: DeployToPreviewEnvironmentPayload): Promise<PreviewEnvironmentVersion> {
    const { data } = await axios.post(
      `${this.apiEndpoint}/preview-environment/deployment-endpoint`,
      {
        message,
        environmentId,
        expiresIn: uploadLinkExpirationOverride || 60,
      },
      {
        headers: {
          Accept: 'application/json',
          'x-zonke-api-key': this.apiKey,
          'x-zonke-api-token': this.apiToken,
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      throw new Error(error.response.data.message);
    });

    const {
      sourceVersion,
      presignedDeploymentEndpoint,
      presignedClientDeploymentEndpoint,
      presignedServerDeploymentEndpoint,
    } = data;

    if (presignedClientDeploymentEndpoint && presignedServerDeploymentEndpoint) {
      return this.deploySplitClientServerBundles({
        message,
        framework,
        environmentId,
        sourceVersion,
        buildOutputDirectory,
        presignedClientDeploymentEndpoint,
        presignedServerDeploymentEndpoint,
      });
    }

    return this.deployCombinedClientServerBundle({
      message,
      environmentId,
      publicDirectory,
      buildOutputDirectory,
      presignedDeploymentEndpoint,
    });
  }


  /**
   * Gets the preview environment with the specified ID.
   */
  async getPreviewEnvironment(environmentId: string): Promise<PreviewEnvironment> {
    const { data } = await axios.post(
      `${this.apiEndpoint}/preview-environment`,
      {
        environmentId,
      },
      {
        headers: {
          Accept: 'application/json',
          'x-zonke-api-key': this.apiKey,
          'x-zonke-api-token': this.apiToken,
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      throw new Error(error.response.data.message);
    });

    return data;
  }


  /**
   * Get the status of a preview environment deployment.
   */
  async getDeploymentStatus({
    environmentId,
    sourceVersion,
  }: PreviewEnvironmentDeploymentStatusPayload): Promise<PreviewEnvironmentDeploymentStatus> {
    const { data } = await axios.post(
      `${this.apiEndpoint}/preview-environment/deployment-status`,
      {
        environmentId,
        sourceVersion,
      },
      {
        headers: {
          Accept: 'application/json',
          'x-zonke-api-key': this.apiKey,
          'x-zonke-api-token': this.apiToken,
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      throw new Error(error.response.data.message);
    });

    return data;
  }


  /**
   * Reverts a preview environment to a previous version. A new version will be created with the same code as the
   * specified version. It is up to you to establish a relationship between the new and reverted versions.
   */
  async revertPreviewEnvironmentToVersion({
    environmentId,
    sourceVersion,
  }: RevertPreviewEnvironmentToVersionPayload): Promise<PreviewEnvironmentDeploymentStatus> {
    const { data } = await axios.post(
      `${this.apiEndpoint}/preview-environment/deploy-version`,
      {
        environmentId,
        sourceVersion,
      },
      {
        headers: {
          Accept: 'application/json',
          'x-zonke-api-key': this.apiKey,
          'x-zonke-api-token': this.apiToken,
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      throw new Error(error.response.data.message);
    });

    return data;
  }


  /**
   * Deletes a preview environment. This will delete all versions of the preview environment as well.
   * 
   * @returns True if the preview environment was deleted successfully.
   */
  async deletePreviewEnvironment(environmentId: string): Promise<boolean> {
    const { data } = await axios.post(
      `${this.apiEndpoint}/preview-environment/delete`,
      {
        environmentId,
      },
      {
        headers: {
          Accept: 'application/json',
          'x-zonke-api-key': this.apiKey,
          'x-zonke-api-token': this.apiToken,
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      throw new Error(error.response.data.message);
    });

    return data;
  }


  private async deployCombinedClientServerBundle({
    message,
    environmentId,
    publicDirectory,
    buildOutputDirectory,
    presignedDeploymentEndpoint,
  }: {
    environmentId: string;
    buildOutputDirectory: string;
    presignedDeploymentEndpoint: string;

    message?: string;
    publicDirectory?: string;
  }): Promise<PreviewEnvironmentVersion> {
    // Copy the build output directory to a temporary directory to preserve the original directory name.
    const outDirectory = mkdtempSync(join(tmpdir(), 'zip-'));
    cpSync(buildOutputDirectory, join(outDirectory, basename(resolve(buildOutputDirectory))), {
      recursive: true,
    });
    if (publicDirectory && existsSync(publicDirectory)) {
      cpSync(publicDirectory, join(outDirectory, 'public'), {
        recursive: true,
      });
    }

    const versionId = await deployDirectoryToS3(outDirectory, presignedDeploymentEndpoint);

    rmSync(outDirectory, {
      recursive: true,
    });

    const version: PreviewEnvironmentVersion = {
      message,
      versionId,
      isLatest: true,
      lastUpdated: new Date().toISOString(),
    };

    if (message) {
      // A deployment tracker is not created in Zonké until after the code is uploaded to S3, so we have to set the 
      // message after the deployment has been triggered.
      await axios.post(
        `${this.apiEndpoint}/preview-environment/set-deployment-message`,
        {
          message,
          environmentId,
          sourceVersion: version.versionId,
        },
        {
          headers: {
            Accept: 'application/json',
            'x-zonke-api-key': this.apiKey,
            'x-zonke-api-token': this.apiToken,
            'Content-Type': 'application/json',
          },
        },
      ).catch((error) => {
        throw new Error(error.response.data.message);
      });
    }

    return version;
  }


  private async deploySplitClientServerBundles({
    message,
    framework,
    environmentId,
    sourceVersion,
    buildOutputDirectory,
    presignedClientDeploymentEndpoint,
    presignedServerDeploymentEndpoint,
  }: {
    environmentId: string;
    sourceVersion: string;
    buildOutputDirectory: string;
    framework: SupportedFrameworks;
    presignedClientDeploymentEndpoint: string;
    presignedServerDeploymentEndpoint: string;

    message?: string;
  }): Promise<PreviewEnvironmentVersion> {
    let directoryMetadata: PreviewEnvironmentDeploymentDirectoryMetadata = {
      hasIndexHtml: false,
      clientDirectory: buildOutputDirectory,
    };

    if (framework === SupportedFrameworks.NextJs && basename(buildOutputDirectory) === '.next') {
      directoryMetadata = prepareNextJsDeployment(buildOutputDirectory);
    } else if (framework === SupportedFrameworks.Remix) {
      directoryMetadata = prepareRemixDeployment(buildOutputDirectory);
    }

    let serverVersion: string | undefined = undefined;
    if (directoryMetadata.serverDirectory) {
      serverVersion = await deployDirectoryToS3(
        directoryMetadata.serverDirectory,
        presignedServerDeploymentEndpoint,
      );
    }

    const clientVersion = await deployDirectoryToS3(
      directoryMetadata.clientDirectory,
      presignedClientDeploymentEndpoint,
    );
    
    await axios.post(
      `${this.apiEndpoint}/preview-environment/complete-deployment`,
      {
        environmentId,
        serverVersion,
        clientVersion,
        sourceVersion,
        hasIndexHtml: directoryMetadata.hasIndexHtml,
      },
      {
        headers: {
          Accept: 'application/json',
          'x-zonke-api-key': this.apiKey,
          'x-zonke-api-token': this.apiToken,
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      throw new Error(error.response.data.message);
    });

    return {
      message,
      isLatest: true,
      versionId: sourceVersion,
      lastUpdated: new Date().toISOString(),
    };
  }
}
