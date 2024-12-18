import { PreviewEnvironment } from '@zonke-cloud/sdk';
import { SupportedFrameworks } from '@zonke-cloud/sdk';


export interface Project {
  /**
   * The name (NOT ID) of the AWS hosted zone to deploy the environment to.
   */
  awsHostedZone: string;
  
  /**
   * The frontend framework the preview environment will be built with.
   */
  framework: SupportedFrameworks;

  /**
   * The deployed preview environment associated with this project.
   */
  environment?: PreviewEnvironment;

  /**
   * The build directory that the preview environment will be built from. This directory will be zipped and
   * deployed to the preview environment.
   */
  buildOutputDirectory: string;

  /**
   * The path to the package.json file.
   * 
   * Remix's server build does not include node modules. This path is used to copy the package.json file to the server
   * build output directory so we can install required dependencies during the deployment. We are making a trade-off
   * here between the size of the deployment package and the time it takes to install dependencies during deployment.
   * Node modules combined with build package versioning can easily blow up S3 storage costs, so we are opting to 
   * install dependencies during deployment.
   */
  packageJsonPath?: string;

  /**
   * The path to the public (static files) directory of the project. This is only required for Next.js projects.
   */
  publicDirectory?: string;
}
