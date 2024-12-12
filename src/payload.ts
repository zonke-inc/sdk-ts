export enum SupportedFrameworks {
  React = 'react',
  Remix = 'remix',
  NextJs = 'nextjs',
  Gatsby = 'gatsby',
}


export interface CreatePreviewEnvironmentPayload {
  /**
   * The name (NOT ID) of the AWS hosted zone to deploy the environment to.
   */
  awsHostedZone: string;

  /**
   * The frontend framework the preview environment will be built with.
   */
  framework: SupportedFrameworks;

  /**
   * A unique identifier of the environment owner. This is an arbitrary string that can be used to group
   * environments and simplify querying. For example, you can use this ID to get/delete all environments
   * owned by this user ID.
   */
  userId?: string;
}


export interface DeployToPreviewEnvironmentPayload {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;

  /**
   * The number of seconds the deployment endpoint will be active for. Default is 60 seconds.
   */
  uploadLinkExpirationOverride?: number;

  /**
   * The build directory that the preview environment will be built from. These directory will be zipped and
   * deployed to the preview environment. Expected directories:
   *    - Next.js standalone - `.next`
   *    - Next.js export vite - `dist`
   *    - Next.js export webpack - `out`
   *    - React static vite - `dist`
   *    - React static webpack - `out`
   */
  buildOutputDirectory: string;
}


export interface PreviewEnvironmentPayload {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;
}


export interface RevertPreviewEnvironmentToVersionPayload {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;

  /**
   * The source version ID to revert to.
   */
  sourceVersion: string;
}


export interface PreviewEnvironmentDeploymentEndpointPayload {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;

  /**
   * The number of seconds the deployment endpoint will be active for. Default is 60 seconds.
   */
  expiresIn?: number;
}


export interface PreviewEnvironmentDeploymentStatusPayload {
  /**
   * The unique identifier of the preview environment.
   */
  environmentId: string;

  /**
   * The version to check the deployment status of.
   */
  sourceVersion: string;
}


export interface UserPreviewEnvironmentsPayload {
  /**
   * A unique identifier of the environment owner. This is an arbitrary string that can be used to group
   * environments and simplify querying.
   */
  userId: string;
}


export interface DeletePreviewEnvironmentsPayload {
  /**
   * The preview environment's unique identifier. One of environmentId or userId is required.
   */
  environmentId?: string;

  /**
   * A unique identifier of the environment owner. One of environmentId or userId is required.
   */
  userId?: string;
}
