import { LogLevel, Logger } from '@resq-systems/logger';
import { extractCdnClientKey } from '../adapters/cfRateLimiter.js';
import { applyCorsHeaders, type CdnService } from '../application/cdnService.js';
import { AssetPath, CdnError, type HttpMethod } from '../domain/asset.js';
import type { RateLimiterPort } from '../domain/ports.js';
import {
  applyCdnRateLimitHeaders,
  type CdnRateLimitDecision,
  classifyCdnRateLimitPolicy,
} from '../domain/rateLimit.js';

const log = Logger.getLogger('[cdn-worker]', {
  minLevel: LogLevel.WARN,
  includeTimestamp: false,
  colorize: false,
});

export interface RouterOptions {
  readonly rateLimiter?: RateLimiterPort;
}

export function createRouter(
  service: CdnService,
  options: RouterOptions = {}
): (request: Request) => Promise<Response> {
  return async function handleRequest(request: Request): Promise<Response> {
    let rateDecision: CdnRateLimitDecision | null = null;

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'OPTIONS') {
        return handleOptions();
      }

      if (path === '/health') {
        return Response.json(service.health());
      }

      if (path === '/health/metrics') {
        return Response.json({
          ...service.health(),
          rateLimiter: options.rateLimiter?.metrics() ?? null,
        });
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD, OPTIONS' },
        });
      }

      // Enforce tiered edge rate limiting before R2/imgproxy/HMAC work
      if (options.rateLimiter) {
        const policy = classifyCdnRateLimitPolicy(request.method, path);
        if (policy) {
          rateDecision = await options.rateLimiter.check(extractCdnClientKey(request), policy);
          if (!rateDecision.allowed) {
            const headers = new Headers({ 'Content-Type': 'application/json' });
            applyCorsHeaders(headers);
            applyCdnRateLimitHeaders(headers, rateDecision);
            return new Response(
              JSON.stringify({
                error: 'Too many requests',
                tier: rateDecision.policy.tier,
                retry_after_seconds: rateDecision.resetDeltaSeconds,
              }),
              { status: 429, headers }
            );
          }
        }
      }

      const method: HttpMethod = request.method;
      const asset = AssetPath.parse(path);

      let response: Response;
      if (path.startsWith('/img/')) {
        response = await service.serveTransformedImage(request, method, asset, url);
      } else if (path.startsWith('/private/')) {
        response = await service.servePrivateAsset(request, method, asset, url);
      } else if (path.startsWith('/assets/')) {
        response = await service.servePublicAsset(request, method, asset);
      } else {
        response = new Response('Not Found', { status: 404 });
      }

      return rateDecision ? withRateLimitHeaders(response, rateDecision) : response;
    } catch (err) {
      if (err instanceof CdnError) {
        const headers = new Headers(err.headers);
        if (rateDecision) {
          applyCdnRateLimitHeaders(headers, rateDecision);
        }
        return new Response(err.message, {
          status: err.status,
          headers,
        });
      }
      log.error('Unhandled CDN Worker error', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}

function withRateLimitHeaders(response: Response, decision: CdnRateLimitDecision): Response {
  const headers = new Headers(response.headers);
  applyCdnRateLimitHeaders(headers, decision);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function handleOptions(): Response {
  const headers = new Headers();
  applyCorsHeaders(headers);
  headers.set('Access-Control-Allow-Headers', 'Range, If-None-Match, Accept');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}
