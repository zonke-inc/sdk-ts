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
   */
  packageJsonPath?: string;
}
