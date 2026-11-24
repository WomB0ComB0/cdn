import { describe, expect, test } from 'bun:test';
import {
  type CfRateLimitBinding,
  CloudflareRateLimiter,
  IsolateSlidingWindowCounter,
} from '../adapters/cfRateLimiter.js';
import {
  applyCdnRateLimitHeaders,
  CDN_RATE_LIMIT_POLICIES,
  classifyCdnRateLimitPolicy,
} from '../domain/rateLimit.js';
import worker, { type WorkerEnv } from '../index.js';

describe('CDN Edge Rate Limiter (Cloudflare bindings + isolate sliding-window fallback)', () => {
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
});
