import type { BuildOptions } from 'esbuild';


export type ResponseMode = 'buffer';
export type BundleOptions = Omit<BuildOptions, 'bundle' | 'entryPoints' | 'outdir' | 'platform'>;
export type DeploymentTarget = 
  'lambda' |        // Hybrid deployment with static assets served from S3 and SSR served from Lambda.
  's3';             // Static-only deployment target.
  // | 'ec2'        // Hybrid deployment with static assets served from S3 and SSR served from EC2.
  // | 'fargate'    // Hybrid deployment with static assets served from S3 and SSR served from Fargate.
  // | 'edge';      // Hybrid deployment with static assets served from S3 and SSR served from CloudFront.

export interface AdapterConfig {
  /**
   * The application's deployment target. We use this to route the request to the correct adapter
   */
  target: DeploymentTarget;
  /**
   * The response mode for the server handler. Defaults to 'buffer'.
   */
  responseMode?: ResponseMode;
  /**
   * Options for bundling the server handler. Defaults to bundling the output if the target is set to Lambda.
   * Set this to 'none' to disable bundling.
   */
  serverBundleOptions?: BundleOptions | 'none';
  /**
   * Versions of packages that were marked as external in `serverBundleOptions.external`. This is used to install
   * the correct versions of the packages in the server environment.
   * 
   * Example:
   * 
   * serverBundleOptions: {
   *  external: ['react', 'react-dom'],
   * }
   * 
   * externalPackageVersions: {
   *  react: '^17.0.2',
   *  'react-dom': '^17.0.2',
   * }
   */
  externalPackageVersions?: Record<string, string>;
}
