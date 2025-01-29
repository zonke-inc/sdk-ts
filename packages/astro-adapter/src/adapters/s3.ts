import type { AstroAdapter, AstroIntegration } from 'astro';

import { ADAPTER_NAME } from '../constants';


function getAdapter(): AstroAdapter {
  return {
    name: ADAPTER_NAME,
    adapterFeatures: {
      edgeMiddleware: false,
      buildOutput: 'static',
    },
    supportedAstroFeatures: {
      staticOutput: 'stable',
      sharpImageService: 'stable',
    },
  };
}


export function createS3Integration(): AstroIntegration {
  return {
    name: ADAPTER_NAME,
    hooks: {
      'astro:config:done': ({ setAdapter }) => {
        setAdapter(getAdapter());
      },
    },
  };
}
