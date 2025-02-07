import axios from 'axios';
import { existsSync } from 'fs-extra';
import { basename, join } from 'path';

import type {
  PostConfiguration,
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
  hasClientServerFolders,
  isAstroSsrBuild,
  prepareAstroDeployment,
  prepareNextJsDeployment,
  prepareRemixDeployment,
  prepareVueDeployment,
  zipDirectory,
  postZipToS3,
  putZipToS3,
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
      maxDeploymentSize,
      presignedClientDeploymentEndpoint,
      presignedServerDeploymentEndpoint,
      presignedClientDeploymentConfiguration,
      presignedServerDeploymentConfiguration,
    } = data;

    let directoryMetadata: PreviewEnvironmentDeploymentDirectoryMetadata = {
      clientDirectory: buildOutputDirectory,
      hasIndexHtml: existsSync(join(buildOutputDirectory, 'index.html')),
    };

    if (framework === SupportedFrameworks.NextJs && basename(buildOutputDirectory) === '.next') {
      directoryMetadata = prepareNextJsDeployment(buildOutputDirectory);
    } else if (framework === SupportedFrameworks.Remix) {
      directoryMetadata = prepareRemixDeployment(buildOutputDirectory);
    } else if (framework === SupportedFrameworks.Astro && isAstroSsrBuild(buildOutputDirectory)) {
      directoryMetadata = prepareAstroDeployment(buildOutputDirectory);
    } else if (framework === SupportedFrameworks.VueJs && hasClientServerFolders(buildOutputDirectory)) {
      directoryMetadata = prepareVueDeployment(buildOutputDirectory);
    }

    let versions: { clientVersion: string; serverVersion?: string; };
    if (presignedClientDeploymentConfiguration && presignedServerDeploymentConfiguration && maxDeploymentSize) {
      versions = await this.postDeployClientServerBundles({
        directoryMetadata,
        maxDeploymentSize,
        presignedClientDeploymentConfiguration,
        presignedServerDeploymentConfiguration,
      });
    } else {
      versions = await this.putDeployClientServerBundles({
        directoryMetadata,
        presignedClientDeploymentEndpoint: presignedClientDeploymentEndpoint!,
        presignedServerDeploymentEndpoint: presignedServerDeploymentEndpoint!,
      });
    }
    
    await axios.post(
      `${this.apiEndpoint}/preview-environment/complete-deployment`,
      {
        environmentId,
        sourceVersion,
        serverVersion: versions.serverVersion,
        clientVersion: versions.clientVersion,
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


  private async postDeployClientServerBundles({
    directoryMetadata,
    maxDeploymentSize,
    presignedClientDeploymentConfiguration,
    presignedServerDeploymentConfiguration,
  }: {
    maxDeploymentSize: number;
    presignedClientDeploymentConfiguration: PostConfiguration;
    presignedServerDeploymentConfiguration: PostConfiguration;
    directoryMetadata: PreviewEnvironmentDeploymentDirectoryMetadata;
  }): Promise<{ clientVersion: string; serverVersion?: string; }> {
    const [clientZip, serverZip] = await Promise.all([
      zipDirectory(directoryMetadata.clientDirectory),
      directoryMetadata.serverDirectory ? zipDirectory(directoryMetadata.serverDirectory) : undefined,
    ]);

    const zipSize = clientZip.length + (serverZip?.length || 0);
    if (zipSize > maxDeploymentSize) {
      throw new Error(`The deployment size '${zipSize}' exceeds the maximum allowed size of '${maxDeploymentSize}' bytes.`);
    }

    const [clientVersion, serverVersion] = await Promise.all([
      postZipToS3(clientZip, presignedClientDeploymentConfiguration),
      serverZip ? postZipToS3(serverZip, presignedServerDeploymentConfiguration) : undefined,
    ]);

    return {
      clientVersion,
      serverVersion,
    };
  }

  private async putDeployClientServerBundles({
    directoryMetadata,
    presignedClientDeploymentEndpoint,
    presignedServerDeploymentEndpoint,
  }: {
    presignedClientDeploymentEndpoint: string;
    presignedServerDeploymentEndpoint: string;
    directoryMetadata: PreviewEnvironmentDeploymentDirectoryMetadata;
  }): Promise<{ clientVersion: string; serverVersion?: string; }> {
    const [clientZip, serverZip] = await Promise.all([
      zipDirectory(directoryMetadata.clientDirectory),
      directoryMetadata.serverDirectory ? zipDirectory(directoryMetadata.serverDirectory) : undefined,
    ]);
    
    const [clientVersion, serverVersion] = await Promise.all([
      putZipToS3(clientZip, presignedClientDeploymentEndpoint),
      serverZip ? putZipToS3(serverZip, presignedServerDeploymentEndpoint) : undefined,
    ]);
  
    return {
      clientVersion,
      serverVersion,
    };
  }
}
