import type { AstroAdapter, AstroConfig, AstroIntegration } from 'astro';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { ADAPTER_NAME } from '../constants';
import type { ResponseMode, AdapterConfig } from '../payload';
import { bundleHandler } from '../util';


function getAdapter(responseMode: ResponseMode): AstroAdapter {
  return {
    name: ADAPTER_NAME,
    serverEntrypoint: ADAPTER_NAME,
    exports: ['handler'],
    args: { responseMode },
    adapterFeatures: {
      edgeMiddleware: false,
      buildOutput: 'server',
    },
    supportedAstroFeatures: {
      staticOutput: 'stable',
      hybridOutput: 'stable',
      serverOutput: 'stable',
      sharpImageService: 'stable',
    },
  };
}


export function createLambdaIntegration(adapterConfig: AdapterConfig): AstroIntegration {
  let astroConfig: AstroConfig;
  const responseMode = adapterConfig.responseMode ?? 'buffer';
  
  return {
    name: ADAPTER_NAME,
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        if (config.output !== 'static') {
          updateConfig({
            build: {
              client: new URL('client/', config.outDir),
              server: new URL('server/', config.outDir),
              serverEntry: 'index.mjs',
            },
          });
        }
      },

      'astro:config:done': ({ config, setAdapter }) => {
        setAdapter(getAdapter(responseMode));

        astroConfig = config;
      },

      'astro:build:done': async () => {
        await writeFile(
					fileURLToPath(new URL('zonke-adapter-metadata.json', astroConfig.outDir)),
          JSON.stringify({
            adapter: adapterConfig,
            astro: astroConfig,
          }, null, 2),
				);

        if (adapterConfig.serverBundleOptions === 'none') {
          return;
        }

        await bundleHandler({
          bundleOptions: adapterConfig.serverBundleOptions ?? {},
          outDir: fileURLToPath(new URL('lambda', astroConfig.outDir)),
          serverEntry: fileURLToPath(new URL(astroConfig.build.serverEntry, astroConfig.build.server)),
        });
      },
    },
  };
}
