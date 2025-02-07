/**
 * The version of a preview environment.
 */
export interface PreviewEnvironmentVersion {
  /**
   * The preview environment's deployed version ID. This version is retrieved from the S3 build.zip object.
   */
  versionId: string;

  /**
   * Short message that describes the change in the version. Think of this as a GIT commit message.
   */
  message?: string;

  /**
   * Whether this is the most recent version of the preview environment.
   */
  isLatest: boolean;

  /**
   * The date and time when the preview environment version was last updated.
   */
  lastUpdated: string;
}


/**
 * A preview environment.
 */
export interface PreviewEnvironment {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;

  /**
   * The endpoint used to access the preview environment. Environment endpoints will have the format: 
   *    https://<endpoint-id>.preview.<mydomain.com>
   */
  endpoint: string;

  /**
   * A list of versions of the preview environment.
   */
  versions: PreviewEnvironmentVersion[];
}


export interface PostConfigurationField {
  /**
   * The POST field key.
   */
  key: string;

  /**
   * The POST field value.
   */
  value: string;
}


export interface PostConfiguration {
  /**
   * A presigned POST URL you can use to deploy static files to the preview environment.
   */
  presignedUrl: string;

  /**
   * Configuration fields required to deploy files to the preview environment.
   */
  fields: PostConfigurationField[];
}


/**
 * A signed URL you can use to deploy to a preview environment.
 */
export interface PreviewEnvironmentDeploymentEndpoint {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;

  /**
   * The signed URL you can use to deploy to the preview environment.
   * 
   * NOTE: This endpoint will be phased out in the future in favor of the `presignedStaticDeploymentEndpoint` and
   * `presignedSsrDeploymentEndpoint` endpoints.
   */
  presignedDeploymentEndpoint: string;

  /**
   * A signed PUT URL you can use to deploy the server-side rendering function to the preview environment.
   */
  presignedServerDeploymentEndpoint?: string;

  /**
   * A signed PUT URL you can use to deploy static files to the preview environment.
   */
  presignedClientDeploymentEndpoint?: string;

  /**
   * The maximum size of the deployment in bytes.
   */
  maxDeploymentSize?: number;

  /**
   * A signed POST configuration you can use to deploy static files to the preview environment.
   */
  presignedClientDeploymentConfiguration?: PostConfiguration;

  /**
   * A signed POST configuration you can use to deploy the server-side rendering function to the preview environment.
   */
  presignedServerDeploymentConfiguration?: PostConfiguration;
}


/**
 * The status of a preview environment deployment.
 */
export interface PreviewEnvironmentDeploymentStatus {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;

  /**
   * The version of the preview environment being deployed.
   */
  sourceVersion: string;

  /**
   * The status of the environment deployment.
   */
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';

  /**
   * The error message if the deployment failed.
   */
  error?: string;
}


export interface PreviewEnvironmentClientProps {
  /**
   * API key used to authenticate with the Zonke API.
   */
  apiKey: string;

  /**
   * API token used to authenticate with the Zonke API.
   */
  apiToken: string;

  /**
   * Zonke API base URL. The production endpoint is https://zonke.dev/api/rest.
   */
  apiEndpoint: string;
}


export interface PreviewEnvironmentDeploymentDirectoryMetadata {
  /**
   * Whether the client deployment directory contains an index.html file.
   */
  hasIndexHtml: boolean;
  
  /**
   * The path to the client deployment directory.
   */
  clientDirectory: string;

  /**
   * The path to the server deployment directory.
   */
  serverDirectory?: string;
}
