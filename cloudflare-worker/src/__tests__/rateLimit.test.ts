import { beforeEach, describe, expect, test } from 'bun:test';
import {
  type CfRateLimitBinding,
  CloudflareRateLimiter,
  extractCdnClientKey,
  IsolateSlidingWindowCounter,
} from '../adapters/cfRateLimiter.js';
import {
  applyCdnRateLimitHeaders,
  CDN_RATE_LIMIT_POLICIES,
  classifyCdnRateLimitPolicy,
} from '../domain/rateLimit.js';
import worker, { type WorkerEnv } from '../index.js';

function createMockCache(): Cache {
  const store = new Map<string, Response>();
  return {
    async match(req: RequestInfo | URL) {
      const key = typeof req === 'string' ? req : req instanceof URL ? req.toString() : req.url;
      return store.get(key)?.clone();
    },
    async put(req: RequestInfo | URL, res: Response) {
      const key = typeof req === 'string' ? req : req instanceof URL ? req.toString() : req.url;
      store.set(key, res);
    },
    async delete() {
      return false;
    },
  } as unknown as Cache;
}

describe('CDN Edge Rate Limiter (Cloudflare bindings + isolate sliding-window fallback)', () => {
  beforeEach(() => {
    (globalThis as unknown as { caches: { default: Cache } }).caches = {
      default: createMockCache(),
    };
  });
  test('classifies CDN paths into tiered policies and exempts health/OPTIONS', () => {
    expect(classifyCdnRateLimitPolicy('OPTIONS', '/assets/a.png')).toBeNull();
    expect(classifyCdnRateLimitPolicy('GET', '/health')).toBeNull();
    expect(classifyCdnRateLimitPolicy('GET', '/health/metrics')).toBeNull();
    expect(classifyCdnRateLimitPolicy('GET', '/assets/u1/pic.png')).toEqual(
      CDN_RATE_LIMIT_POLICIES.assets
    );
    expect(classifyCdnRateLimitPolicy('GET', '/img/assets/u1/pic.png')).toEqual(
      CDN_RATE_LIMIT_POLICIES.img
    );
    expect(classifyCdnRateLimitPolicy('GET', '/private/u1/doc.pdf')).toEqual(
      CDN_RATE_LIMIT_POLICIES.private
    );
  });

  test('enforces Cloudflare native RateLimit binding and returns 429 + IETF headers', async () => {
    let calls = 0;
    const imgBinding: CfRateLimitBinding = {
      async limit({ key }) {
        calls += 1;
        expect(key).toBe('img:ip:203.0.113.7');
        return { success: calls <= 1 };
      },
    };

    const env: WorkerEnv = {
      R2_BUCKET: {
        async get() {
          return null;
        },
        async head() {
          return null;
        },
      } as unknown as R2Bucket,
      IMGPROXY_URL: 'https://img.mikeodnis.dev',
      R2_BUCKET_NAME: 'cdn',
      RATE_LIMIT_IMG: imgBinding,
    };
    const ctx = { waitUntil() {} } as unknown as ExecutionContext;

    const req = () =>
      new Request('https://cdn.mikeodnis.dev/img/private/u1/secret.png?w=300', {
        headers: { 'cf-connecting-ip': '203.0.113.7' },
      });

    // 1st request allowed by binding -> reaches CdnService (403 private img) WITH RateLimit-* headers
    const r1 = await worker.fetch(req(), env, ctx);
    expect(r1.status).toBe(403);
    expect(r1.headers.get('RateLimit-Limit')).toBe('60');
    expect(r1.headers.get('RateLimit-Policy')).toBe('60;w=60');

    // 2nd request rejected by binding -> 429 + Retry-After before touching imgproxy/R2
    const r2 = await worker.fetch(req(), env, ctx);
    expect(r2.status).toBe(429);
    expect(r2.headers.get('RateLimit-Remaining')).toBe('0');
    expect(r2.headers.get('Retry-After')).toBeTruthy();
    const body = (await r2.json()) as { error: string; tier: string };
    expect(body.tier).toBe('img');
  });

  test('falls back cleanly to weighted sliding-window counter if Cloudflare binding throws', async () => {
    let nowMs = 119_000; // 98% through [60s, 120s)
    const brokenBinding: CfRateLimitBinding = {
      async limit() {
        throw new Error('binding transient failure');
      },
    };
    const limiter = new CloudflareRateLimiter(
      { img: brokenBinding },
      new IsolateSlidingWindowCounter(100),
      () => nowMs
    );
    const tinyPolicy = { tier: 'img' as const, limit: 2, periodSeconds: 60 as const };

    const d1 = await limiter.check('ip:198.51.100.2', tinyPolicy);
    expect(d1.allowed).toBe(true);
    expect(d1.mode).toBe('isolate-fallback');

    const d2 = await limiter.check('ip:198.51.100.2', tinyPolicy);
    expect(d2.allowed).toBe(true);

    const d3 = await limiter.check('ip:198.51.100.2', tinyPolicy);
    expect(d3.allowed).toBe(false);

    // Just past window boundary (120_500 -> ~99% weight on prev 2) -> still blocked (no boundary spike)
    nowMs = 120_500;
    const boundary = await limiter.check('ip:198.51.100.2', tinyPolicy);
    expect(boundary.allowed).toBe(false);

    const headers = new Headers();
    applyCdnRateLimitHeaders(headers, boundary);
    expect(headers.get('RateLimit-Policy')).toBe('2;w=60');
    expect(headers.get('Retry-After')).toBeTruthy();

    const m = limiter.metrics();
    expect(m.evaluated).toBe(4);
    expect(m.bindingErrors).toBe(4);
    expect(m.isolateFallbackHits).toBe(4);
    expect(m.limited429).toBe(2);
    expect(m.limitedByTier['img']).toBe(2);
  });

  test('trusts X-Gateway-Client-IP only when X-Gateway-Proxy-Secret matches in constant time', () => {
    const secret = 'gateway-proxy-secret-32-bytes-minimum!';
    const trustedReq = new Request('https://cdn.mikeodnis.dev/assets/u1/a.png', {
      headers: {
        'cf-connecting-ip': '35.1.2.3',
        'x-gateway-proxy-secret': secret,
        'x-gateway-client-ip': '198.51.100.88',
      },
    });
    expect(extractCdnClientKey(trustedReq, secret)).toBe('ip:198.51.100.88');

    // Forged or missing secret must NEVER trust X-Gateway-Client-IP -> falls back to CF-Connecting-IP
    const spoofedReq = new Request('https://cdn.mikeodnis.dev/assets/u1/a.png', {
      headers: {
        'cf-connecting-ip': '203.0.113.9',
        'x-gateway-proxy-secret': 'wrong-secret-value-attempt-1234567890',
        'x-gateway-client-ip': '198.51.100.88',
      },
    });
    expect(extractCdnClientKey(spoofedReq, secret)).toBe('ip:203.0.113.9');
    expect(extractCdnClientKey(spoofedReq, undefined)).toBe('ip:203.0.113.9');
  });
});
