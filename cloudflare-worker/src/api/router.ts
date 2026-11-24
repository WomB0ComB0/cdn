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
import {
  API_ORIGIN,
  CDN_LINK_HEADER,
  CDN_LLMS_FULL_TXT,
  CDN_LLMS_TXT,
  CDN_OPENAPI_YAML,
  CDN_ROBOTS_TXT,
  CDN_SECURITY_TXT,
  CDN_SERVICE_DESCRIPTOR,
  CDN_SITEMAP_XML,
} from './discovery.js';
import {
  CDN_ICON_SVG,
  CDN_MANIFEST_JSON,
  CDN_SW_JS,
  renderCdnHomePage,
  renderUploadStudioPage,
} from './pages.js';

const log = Logger.getLogger('[cdn-worker]', {
  minLevel: LogLevel.WARN,
  includeTimestamp: false,
  colorize: false,
});

const CSP_HTML_HOME = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const CSP_HTML_UPLOAD = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.mikeodnis.dev",
  `connect-src 'self' ${API_ORIGIN} https://*.r2.cloudflarestorage.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function staticResponse(
  method: HttpMethod,
  body: string,
  contentType: string,
  options: {
    cacheControl: string;
    corp?: 'same-site' | 'cross-origin';
    csp?: string;
    linkHeader?: boolean;
  }
): Response {
  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': options.cacheControl,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': options.corp ?? 'same-site',
  });
  if (options.csp) {
    headers.set('Content-Security-Policy', options.csp);
  }
  if (options.linkHeader) {
    headers.set('Link', CDN_LINK_HEADER);
  }
  return new Response(method === 'HEAD' ? null : body, { status: 200, headers });
}

function prefersJson(request: Request): boolean {
  const accept = (request.headers.get('Accept') || '').toLowerCase();
  if (!accept) return false;
  return accept.includes('application/json') && !accept.includes('text/html');
}

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

      const method: HttpMethod = request.method;

      // Static Live Console landing page, Upload Studio PWA, and LLM/AEO/security discovery routes
      if (path === '/' || path === '') {
        if (prefersJson(request)) {
          return staticResponse(
            method,
            JSON.stringify(CDN_SERVICE_DESCRIPTOR, null, 2),
            'application/json; charset=utf-8',
            { cacheControl: 'public, max-age=300', corp: 'cross-origin', linkHeader: true }
          );
        }
        return staticResponse(method, renderCdnHomePage(), 'text/html; charset=utf-8', {
          cacheControl: 'public, max-age=300',
          csp: CSP_HTML_HOME,
          linkHeader: true,
        });
      }

      if (path === '/upload') {
        return staticResponse(method, renderUploadStudioPage(), 'text/html; charset=utf-8', {
          cacheControl: 'public, max-age=300',
          csp: CSP_HTML_UPLOAD,
        });
      }

      if (path === '/manifest.webmanifest') {
        return staticResponse(
          method,
          CDN_MANIFEST_JSON,
          'application/manifest+json; charset=utf-8',
          { cacheControl: 'public, max-age=3600', corp: 'cross-origin' }
        );
      }

      if (path === '/icon.svg') {
        return staticResponse(method, CDN_ICON_SVG, 'image/svg+xml; charset=utf-8', {
          cacheControl: 'public, max-age=86400',
          corp: 'cross-origin',
        });
      }

      if (path === '/sw.js') {
        return staticResponse(method, CDN_SW_JS, 'application/javascript; charset=utf-8', {
          cacheControl: 'no-cache, max-age=0, must-revalidate',
        });
      }

      if (path === '/llms.txt') {
        return staticResponse(method, CDN_LLMS_TXT, 'text/markdown; charset=utf-8', {
          cacheControl: 'public, max-age=3600',
          corp: 'cross-origin',
          linkHeader: true,
        });
      }

      if (path === '/llms-full.txt') {
        return staticResponse(method, CDN_LLMS_FULL_TXT, 'text/markdown; charset=utf-8', {
          cacheControl: 'public, max-age=3600',
          corp: 'cross-origin',
          linkHeader: true,
        });
      }

      if (path === '/.well-known/security.txt') {
        return staticResponse(method, CDN_SECURITY_TXT, 'text/plain; charset=utf-8', {
          cacheControl: 'public, max-age=86400',
          corp: 'cross-origin',
        });
      }

      if (path === '/robots.txt') {
        return staticResponse(method, CDN_ROBOTS_TXT, 'text/plain; charset=utf-8', {
          cacheControl: 'public, max-age=3600',
          corp: 'cross-origin',
        });
      }

      if (path === '/sitemap.xml') {
        return staticResponse(method, CDN_SITEMAP_XML, 'application/xml; charset=utf-8', {
          cacheControl: 'public, max-age=3600',
          corp: 'cross-origin',
        });
      }

      if (path === '/openapi.yaml') {
        return staticResponse(method, CDN_OPENAPI_YAML, 'application/yaml; charset=utf-8', {
          cacheControl: 'public, max-age=3600',
          corp: 'cross-origin',
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
