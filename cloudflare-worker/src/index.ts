import { CloudflareEdgeCache } from './adapters/cfEdgeCache.js';
import {
  type CfRateLimitBinding,
  CloudflareRateLimiter,
  IsolateSlidingWindowCounter,
} from './adapters/cfRateLimiter.js';
import { HmacSignatureVerifier } from './adapters/hmacSignatureVerifier.js';
import { ImgproxyClient } from './adapters/imgproxyClient.js';
import { R2ObjectStore } from './adapters/r2ObjectStore.js';
import { createRouter } from './api/router.js';
import { CdnService } from './application/cdnService.js';

const DEFAULT_CACHE_TTL_IMMUTABLE = 31536000; // 1 year
const DEFAULT_CACHE_TTL_PRIVATE = 3600; // 1 hour

// Primitive-only bounded fallback counter for local dev / transient binding errors
const isolateFallbackCounter = new IsolateSlidingWindowCounter(4096);

export interface WorkerEnv {
  R2_BUCKET: R2Bucket;
  R2_BUCKET_NAME?: string;
  SIGNING_SECRET?: string;
  IMGPROXY_URL?: string;
  CACHE_TTL_IMMUTABLE?: string;
  CACHE_TTL_PRIVATE?: string;
  RATE_LIMIT_ASSETS?: CfRateLimitBinding;
  RATE_LIMIT_IMG?: CfRateLimitBinding;
  RATE_LIMIT_PRIVATE?: CfRateLimitBinding;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const service = new CdnService({
      objectStore: new R2ObjectStore(env.R2_BUCKET),
      edgeCache: new CloudflareEdgeCache(caches.default, (p) => ctx.waitUntil(p)),
      signatureVerifier: new HmacSignatureVerifier(env.SIGNING_SECRET || ''),
      imageProxy: new ImgproxyClient(env.IMGPROXY_URL, env.R2_BUCKET_NAME),
      clock: { nowSeconds: () => Math.floor(Date.now() / 1000) },
      config: {
        cacheTtlImmutable: Number(env.CACHE_TTL_IMMUTABLE) || DEFAULT_CACHE_TTL_IMMUTABLE,
        cacheTtlPrivate: Number(env.CACHE_TTL_PRIVATE) || DEFAULT_CACHE_TTL_PRIVATE,
        signingConfigured: Boolean(env.SIGNING_SECRET),
      },
    });

    const rateLimiter = new CloudflareRateLimiter(
      {
        assets: env.RATE_LIMIT_ASSETS,
        img: env.RATE_LIMIT_IMG,
        private: env.RATE_LIMIT_PRIVATE,
      },
      isolateFallbackCounter
    );

    return createRouter(service, { rateLimiter })(request);
  },
};
