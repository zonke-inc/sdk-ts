import { PreviewEnvironment } from '@zonke-cloud/sdk';
import { SupportedFrameworks } from '@zonke-cloud/sdk';


export interface ZonkeCredentials {
  /**
   * API key.
   */
  apiKey: string;

  /**
   * API secret token.
   */
  apiToken: string;
}


export interface InitializeProjectPayload {
  /**
   * The name (NOT ID) of the AWS hosted zone to deploy the environment to.
   */
  awsHostedZone: string;

  /**
   * The frontend framework the preview environment will be built with.
   */
  framework: SupportedFrameworks;

  /**
   * The build directory that the preview environment will be built from. This directory will be zipped and
   * deployed to the preview environment.
   */
  buildOutputDirectory: string;

  /**
   * The deployed preview environment associated with this project.
   */
  environment?: PreviewEnvironment;
}
