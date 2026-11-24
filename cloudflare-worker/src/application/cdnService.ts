import {
  AssetPath,
  CdnError,
  type HttpMethod,
  parseImageTransform,
  parseSignedRequest,
} from '../domain/asset.js';
import type {
  ClockPort,
  EdgeCachePort,
  ImageProxyPort,
  ObjectStorePort,
  SignatureVerifierPort,
  StoredObject,
} from '../domain/ports.js';

export interface CdnServiceConfig {
  readonly cacheTtlImmutable: number;
  readonly cacheTtlPrivate: number;
  readonly signingConfigured: boolean;
}

export interface CdnServiceDeps {
  readonly objectStore: ObjectStorePort;
  readonly edgeCache: EdgeCachePort;
  readonly signatureVerifier: SignatureVerifierPort;
  readonly imageProxy: ImageProxyPort;
  readonly clock: ClockPort;
  readonly config: CdnServiceConfig;
}

export class CdnService {
  constructor(private readonly deps: CdnServiceDeps) {}

  health(): { status: 'healthy'; service: 'cdn-worker' } {
    return { status: 'healthy', service: 'cdn-worker' };
  }

  async servePublicAsset(request: Request, method: HttpMethod, asset: AssetPath): Promise<Response> {
    const hasRange = request.headers.has('range');
    // Canonicalize cache key without query strings so ?cb=<random> cannot bypass Edge Cache and hammer R2.
    const reqUrl = new URL(request.url);
    const cacheKey = new Request(`${reqUrl.origin}/${asset.objectKey}`, { method: 'GET' });
    if (!hasRange && method === 'GET') {
      const cached = await this.deps.edgeCache.match(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const object =
      method === 'HEAD'
        ? await this.deps.objectStore.head(asset.objectKey)
        : await this.deps.objectStore.get(asset.objectKey, {
            headers: request.headers,
            includeConditional: true,
          });

    if (!object) {
      throw new CdnError(404, 'Not Found');
    }

    const response = this.buildObjectResponse(object, method, hasRange, {
      cacheControl: `public, max-age=${this.deps.config.cacheTtlImmutable}, immutable`,
      cdnCacheControl: `public, max-age=${this.deps.config.cacheTtlImmutable}`,
    });

    if (response.status === 200 && method === 'GET') {
      this.deps.edgeCache.put(cacheKey, response.clone());
    }

    return response;
  }

  async servePrivateAsset(
    request: Request,
    method: HttpMethod,
    asset: AssetPath,
    url: URL
  ): Promise<Response> {
    if (!this.deps.config.signingConfigured) {
      throw new CdnError(500, 'Signing secret not configured');
    }

    const signed = parseSignedRequest(
      asset,
      url.searchParams.get('sig'),
      url.searchParams.get('exp'),
      this.deps.clock.nowSeconds()
    );

    const valid = await this.deps.signatureVerifier.verify(
      signed.pathname,
      signed.expiresRaw,
      signed.signature
    );
    if (!valid) {
      throw new CdnError(403, 'Invalid signature');
    }

    const object =
      method === 'HEAD'
        ? await this.deps.objectStore.head(signed.objectKey)
        : await this.deps.objectStore.get(signed.objectKey, {
            headers: request.headers,
            includeConditional: false,
          });

    if (!object) {
      throw new CdnError(404, 'Not Found');
    }

    return this.buildObjectResponse(object, method, request.headers.has('range'), {
      cacheControl: `private, max-age=${this.deps.config.cacheTtlPrivate}, no-transform`,
      cdnCacheControl: 'no-store',
      isPrivate: true,
    });
  }

  async serveTransformedImage(
    request: Request,
    method: HttpMethod,
    asset: AssetPath,
    url: URL
  ): Promise<Response> {
    if (!this.deps.imageProxy.isConfigured()) {
      throw new CdnError(503, 'Image proxy not configured');
    }

    const transform = parseImageTransform(asset, {
      width: url.searchParams.get('w'),
      height: url.searchParams.get('h'),
      quality: url.searchParams.get('q'),
      format: url.searchParams.get('f'),
    });

    const cacheKey = new Request(url.toString(), { method: 'GET' });
    if (method === 'GET') {
      const cached = await this.deps.edgeCache.match(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const accept = request.headers.get('Accept') || 'image/avif,image/webp,*/*';
    const upstream = await this.deps.imageProxy.fetchTransformed(method, transform, accept);
    if (!upstream.ok) {
      throw new CdnError(upstream.status, 'Image processing failed');
    }

    const headers = new Headers(upstream.headers);
    const ttl = this.deps.config.cacheTtlImmutable;
    headers.set('Cache-Control', `public, max-age=${ttl}, immutable`);
    headers.set('CDN-Cache-Control', `public, max-age=${ttl}`);
    applySecurityHeaders(headers);
    applyCorsHeaders(headers);

    const response = new Response(method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    });

    if (method === 'GET' && upstream.status === 200) {
      this.deps.edgeCache.put(cacheKey, response.clone());
    }

    return response;
  }

  private buildObjectResponse(
    object: StoredObject,
    method: HttpMethod,
    hasRange: boolean,
    cache: { cacheControl: string; cdnCacheControl?: string; isPrivate?: boolean }
  ): Response {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.etag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', cache.cacheControl);
    if (cache.cdnCacheControl) {
      headers.set('CDN-Cache-Control', cache.cdnCacheControl);
    }
    if (cache.isPrivate) {
      // Prevent leaking signed ?exp=&sig= query params in Referer headers or search engine indexes
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
    applySecurityHeaders(headers);
    applyCorsHeaders(headers);

    if (method === 'GET' && !object.hasBody) {
      return new Response(null, { status: 304, headers });
    }

    let status = 200;
    if (hasRange && object.range) {
      const { offset, length } = object.range;
      headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
      headers.set('Content-Length', String(length));
      status = 206;
    } else {
      headers.set('Content-Length', String(object.size));
    }

    const body = method === 'HEAD' ? null : (object.body as BodyInit | null);
    return new Response(body, { status, headers });
  }
}

export function applySecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  const contentType = (headers.get('Content-Type') || '').toLowerCase();
  if (contentType.includes('svg') || contentType.includes('html') || contentType.includes('xml')) {
    // Prevent Stored XSS when rendering user-uploaded SVGs/XML/HTML directly on the CDN origin
    headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  }
  if (
    contentType.includes('text/html') ||
    contentType.includes('xhtml') ||
    contentType.includes('application/xml') ||
    contentType.includes('text/xml') ||
    contentType.includes('application/zip') ||
    contentType.includes('application/octet-stream')
  ) {
    // Force download instead of inline browser execution/rendering for active or opaque payloads
    headers.set('Content-Disposition', 'attachment');
  }
}

export function applyCorsHeaders(headers: Headers): void {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set(
    'Access-Control-Expose-Headers',
    'ETag, Content-Length, Content-Range, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, RateLimit-Policy, Retry-After'
  );
}
