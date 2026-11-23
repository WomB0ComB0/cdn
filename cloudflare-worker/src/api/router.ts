import { LogLevel, Logger } from '@resq-systems/logger';
import { applyCorsHeaders, type CdnService } from '../application/cdnService.js';
import { AssetPath, CdnError, type HttpMethod } from '../domain/asset.js';

const log = Logger.getLogger('[cdn-worker]', {
  minLevel: LogLevel.WARN,
  includeTimestamp: false,
  colorize: false,
});

export function createRouter(service: CdnService): (request: Request) => Promise<Response> {
  return async function handleRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'OPTIONS') {
        return handleOptions();
      }

      if (path === '/health') {
        return Response.json(service.health());
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD, OPTIONS' },
        });
      }

      const method: HttpMethod = request.method;
      const asset = AssetPath.parse(path);

      if (path.startsWith('/img/')) {
        return await service.serveTransformedImage(request, method, asset, url);
      }

      if (path.startsWith('/private/')) {
        return await service.servePrivateAsset(request, method, asset, url);
      }

      if (path.startsWith('/assets/')) {
        return await service.servePublicAsset(request, method, asset);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      if (err instanceof CdnError) {
        return new Response(err.message, {
          status: err.status,
          ...(err.headers ? { headers: err.headers } : {}),
        });
      }
      log.error('Unhandled CDN Worker error', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}

function handleOptions(): Response {
  const headers = new Headers();
  applyCorsHeaders(headers);
  headers.set('Access-Control-Allow-Headers', 'Range, If-None-Match, Accept');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}
