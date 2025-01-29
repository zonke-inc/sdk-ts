import type { AstroIntegration, SSRManifest } from 'astro';

import { createS3Integration } from './adapters/s3';
import { createLambdaIntegration } from './adapters/lambda';
import { createLambdaExports } from './entrypoints/lambda';
import { type AdapterConfig } from './payload';


function createExports(manifest: SSRManifest) {
  return createLambdaExports(manifest);
}

function createIntegration(adapterConfig: AdapterConfig): AstroIntegration {
  if (adapterConfig.target === 's3') {
    return createS3Integration();
  }

  return createLambdaIntegration(adapterConfig);
}

export {
  type AdapterConfig,
  createExports,
  createIntegration as default,
};
