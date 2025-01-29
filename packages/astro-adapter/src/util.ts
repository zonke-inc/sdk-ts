import { NodeApp } from 'astro/app/node';
import { build, type BuildOptions } from 'esbuild';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { mergeAndConcat } from 'merge-anything';

import { BINARY_MEDIA_TYPES } from './constants';
import type { BundleOptions } from './payload';


const DEFAULT_BUNDLE_OPTIONS: BuildOptions = {
	bundle: true,
  minify: true,
	metafile: true,
	platform: 'node',
	target: 'node20',
	allowOverwrite: true,
	external: ['fsevents'],
};


export async function bundleHandler({
  outDir,
  serverEntry,
  bundleOptions,
} : {
  outDir: string;
  serverEntry: string;
  bundleOptions: BundleOptions;
}): Promise<void> {
  const external = Array.from(new Set([
    ...(bundleOptions.external || []),
    ...(DEFAULT_BUNDLE_OPTIONS.external || []),
  ]));
	const config = mergeAndConcat(DEFAULT_BUNDLE_OPTIONS,
    {
      ...bundleOptions,
      external,
    },
    {
      banner: {
        js: [
          "import { createRequire as astroAdapterCreateRequire } from 'module';",
          "import { dirname as astroAdapterDirname } from 'path';",
          "import { fileURLToPath as astroAdapterFileURLToPath } from 'url';",
          'const require = astroAdapterCreateRequire(import.meta.url);',
          'const __filename = astroAdapterFileURLToPath(import.meta.url);',
          'const __dirname = astroAdapterDirname(__filename);',
          '',
        ].join('\n'),
      },
      format: 'esm',
      outdir: outDir,
      entryPoints: [serverEntry],
      outExtension: {
        '.js': '.mjs',
      },
	  } satisfies BuildOptions
  );

	await build(config);
}

export function getHeaderBag(event: APIGatewayProxyEventV2): Record<string, string> {
  const headers: Record<string, string> = {};
  if (event.cookies) {
    headers.cookie = event.cookies.join('; ');
  }

  for (const [key, value] of Object.entries(event.headers)) {
    headers[key.toLowerCase()] = value!;
  }

  return headers;
}

export function getRequestBody(event: APIGatewayProxyEventV2): string | Buffer | undefined {
  if (event.body && event.isBase64Encoded && !['GET', 'HEAD'].includes(event.requestContext.http.method)) {
    return Buffer.from(event.body, 'base64');
  }

  return event.body;
}

export async function formatResponse(
  app: NodeApp,
  response: Response,
): Promise<APIGatewayProxyStructuredResultV2> {
  const cookies = [...app.setCookieHeaders(response)];
  const headers: Record<string, string> = Array.from(
    response.headers.entries()
  ).filter(([key]) => key !== 'set-cookie')
    .reduce((headers, [key, value]) => {
      headers[key] = value;
      return headers;
    }, {} as Record<string, string>);

  const isBase64Encoded = BINARY_MEDIA_TYPES.has(headers['content-type']?.split(';')[0] ?? '');
  const body = isBase64Encoded ?
    Buffer.from(await response.arrayBuffer()).toString('base64') :
    await response.text();
  
  return {
    body,
    cookies,
    headers,
    isBase64Encoded,
    statusCode: response.status,
  };
}

export async function get404Response(
  app: NodeApp,
  event: APIGatewayProxyEventV2,
  headers: Record<string, string>
) {

  const custom404 = new Request(new URL('404', `https://${event.headers.host}`), {
    headers,
    body: getRequestBody(event),
    method: event.requestContext.http.method,
  });

  const routeData = app.match(custom404);
  if (routeData) {
    const response = await app.render(custom404, {
      routeData
    });

    return formatResponse(app, response);
  }

  return {
    statusCode: 404,
    body: 'Not found',
    headers: {
      'content-type': 'text/plain',
    },
  };
}
