import { type SSRManifest } from 'astro';
import { applyPolyfills, NodeApp } from 'astro/app/node';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { formatResponse, get404Response, getHeaderBag, getRequestBody } from '../util';


applyPolyfills();


export function createLambdaExports(manifest: SSRManifest) {
  const app = new NodeApp(manifest);
  async function handler(event: APIGatewayProxyEventV2) {

    if (event.headers['x-forwarded-host']) {
      event.headers.host = event.headers['x-forwarded-host'];
    }
    const path = event.rawQueryString ? `${event.rawPath}?${event.rawQueryString}` : event.rawPath;
    const headers = getHeaderBag(event);
    const request = new Request(new URL(path, `https://${event.headers.host}`), {
      headers,
      body: getRequestBody(event),
      method: event.requestContext.http.method,
    });

    const routeData = app.match(request);
    if (!routeData) {
      return get404Response(app, event, headers);
    }

    const response = await app.render(request, {
      routeData,
    });

    return formatResponse(app, response);
  }

  return { handler };
}
