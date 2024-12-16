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
   */
  presignedDeploymentEndpoint: string;
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
   * The status of the environment deployment. Options are "SCHEDULED", "IN_PROGRESS", "SUCCEEDED", or "FAILED".
   * Leaving this field as a string instead of an enum to allow for non-breaking future changes.
   */
  status: string;

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
