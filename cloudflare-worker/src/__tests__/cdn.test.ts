import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
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

interface MockEntry {
  body: string;
  contentType?: string;
}

function createMockEnv(objects: Record<string, MockEntry> = {}): WorkerEnv {
  return {
    SIGNING_SECRET: 'shared-signing-secret-32-bytes-long!!',
    R2_BUCKET_NAME: 'cdn',
    R2_BUCKET: {
      async get(key: string) {
        const entry = objects[key];
        if (!entry) return null;
        return {
          body: entry.body,
          size: entry.body.length,
          httpEtag: '"etag-abc"',
          writeHttpMetadata(headers: Headers) {
            headers.set('Content-Type', entry.contentType || 'application/octet-stream');
          },
        };
      },
      async head(key: string) {
        const entry = objects[key];
        if (!entry) return null;
        return {
          size: entry.body.length,
          httpEtag: '"etag-abc"',
          writeHttpMetadata(headers: Headers) {
            headers.set('Content-Type', entry.contentType || 'application/octet-stream');
          },
        };
      },
    } as unknown as R2Bucket,
  };
}

function signLikeGoMediaService(secret: string, path: string, expUnix: number): string {
  return createHmac('sha256', secret).update(`${path}:${expUnix}`).digest('base64url');
}

describe('cdn-worker hexagonal architecture (cdn.mikeodnis.dev)', () => {
  (globalThis as unknown as { caches: { default: Cache } }).caches = { default: createMockCache() };

  test('health, method guards, and OPTIONS CORS preflight', async () => {
    const env = createMockEnv();
    const ctx = { waitUntil() {} } as unknown as ExecutionContext;

    const health = await worker.fetch(new Request('https://cdn.mikeodnis.dev/health'), env, ctx);
    expect(health.status).toBe(200);
    expect(health.headers.get('Cache-Control')).toBe('no-store');
    expect(health.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await health.json()) as { status: string; service: string }).toEqual({
      status: 'healthy',
      service: 'cdn-worker',
    });

    const opts = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/u1/img.png', { method: 'OPTIONS' }),
      env,
      ctx
    );
    expect(opts.status).toBe(204);
    expect(opts.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const post = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/u1/img.png', { method: 'POST' }),
      env,
      ctx
    );
    expect(post.status).toBe(405);
  });

  test('serves public R2 asset under /assets/ with immutable cache headers & HEAD support', async () => {
    (globalThis as unknown as { caches: { default: Cache } }).caches = {
      default: createMockCache(),
    };
    const env = createMockEnv({
      'assets/user-1/logo.png': { body: 'png-bytes', contentType: 'image/png' },
    });
    const waited: Promise<unknown>[] = [];
    const ctx = { waitUntil(p: Promise<unknown>) { waited.push(p); } } as unknown as ExecutionContext;

    const res = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/logo.png'),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('ETag')).toBe('"etag-abc"');
    expect(await res.text()).toBe('png-bytes');
    expect(waited.length).toBe(1);
    await Promise.all(waited);

    // Second GET with arbitrary cache-buster query string still hits canonical edge cache
    const cached = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/logo.png?cb=bypass-attempt'),
      env,
      ctx
    );
    expect(cached.status).toBe(200);
    expect(await cached.text()).toBe('png-bytes');

    // HEAD returns headers with empty body
    const head = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/logo.png', { method: 'HEAD' }),
      env,
      ctx
    );
    expect(head.status).toBe(200);
    expect(head.headers.get('Content-Length')).toBe('9');
    expect(await head.text()).toBe('');
  });

  test('validates Go media-service HMAC signatures on /private/ assets', async () => {
    const env = createMockEnv({
      'private/user-1/invoice.pdf': { body: 'pdf-secret', contentType: 'application/pdf' },
    });
    const ctx = { waitUntil() {} } as unknown as ExecutionContext;
    const path = '/private/user-1/invoice.pdf';
    const futureExp = Math.floor(Date.now() / 1000) + 300;
    const validSig = signLikeGoMediaService(env.SIGNING_SECRET!, path, futureExp);

    const ok = await worker.fetch(
      new Request(`https://cdn.mikeodnis.dev${path}?exp=${futureExp}&sig=${validSig}`),
      env,
      ctx
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toContain('private');
    expect(ok.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(ok.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(ok.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await ok.text()).toBe('pdf-secret');

    const badSig = await worker.fetch(
      new Request(`https://cdn.mikeodnis.dev${path}?exp=${futureExp}&sig=${validSig}x`),
      env,
      ctx
    );
    expect(badSig.status).toBe(403);

    const pastExp = Math.floor(Date.now() / 1000) - 10;
    const expiredSig = signLikeGoMediaService(env.SIGNING_SECRET!, path, pastExp);
    const expired = await worker.fetch(
      new Request(`https://cdn.mikeodnis.dev${path}?exp=${pastExp}&sig=${expiredSig}`),
      env,
      ctx
    );
    expect(expired.status).toBe(403);

    const normalizedTraversal = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/../private/user-1/invoice.pdf'),
      env,
      ctx
    );
    expect(normalizedTraversal.status).toBe(403);

    const badKey = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/foo..bar.png'),
      env,
      ctx
    );
    expect(badKey.status).toBe(400);
  });

  test('rejects /img/ transforms for private/ objects or unconfigured imgproxy', async () => {
    const ctx = { waitUntil() {} } as unknown as ExecutionContext;

    const unconfigured = createMockEnv();
    const res503 = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/img/assets/u1/pic.png?w=400'),
      unconfigured,
      ctx
    );
    expect(res503.status).toBe(503);

    const configured: WorkerEnv = { ...createMockEnv(), IMGPROXY_URL: 'https://img.mikeodnis.dev' };
    const res403 = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/img/private/u1/secret.png?w=400'),
      configured,
      ctx
    );
    expect(res403.status).toBe(403);

    // Fail-closed allowlist: non-assets/* prefixes are also forbidden on /img/
    const otherPrefix = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/img/backups/u1/secret.png?w=400'),
      configured,
      ctx
    );
    expect(otherPrefix.status).toBe(403);

    // Non-raster files (e.g. SVG/PDF/ZIP) must never be forwarded to imgproxy (415)
    const svgTransform = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/img/assets/u1/logo.svg?w=400'),
      configured,
      ctx
    );
    expect(svgTransform.status).toBe(415);

    // NUL byte or double-slash path injection returns 400
    const nulPath = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/u1/pic%00.png'),
      configured,
      ctx
    );
    expect(nulPath.status).toBe(400);

    // Unconfirmed presigned staging/* objects are NEVER servable from the CDN edge (404)
    const stagedEnv = createMockEnv({
      'staging/assets/u1/unverified.svg': {
        body: '<svg><script>alert(1)</script></svg>',
        contentType: 'image/svg+xml',
      },
    });
    const stagedRes = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/staging/assets/u1/unverified.svg'),
      stagedEnv,
      ctx
    );
    expect(stagedRes.status).toBe(404);

    // Quarantined objects moved by continuous security scanner are NEVER servable from /quarantine/* or /img/quarantine/*
    const quarantinedEnv = createMockEnv({
      'quarantine/assets/u1/flagged.pdf': {
        body: '%PDF-1.7 flagged',
        contentType: 'application/pdf',
      },
    });
    const quarantinedRes = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/quarantine/assets/u1/flagged.pdf'),
      quarantinedEnv,
      ctx
    );
    expect(quarantinedRes.status).toBe(404);
    const quarantinedImg = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/img/quarantine/assets/u1/flagged.png?w=200'),
      { ...quarantinedEnv, IMGPROXY_URL: 'https://img.mikeodnis.dev' },
      ctx
    );
    expect(quarantinedImg.status).toBe(403);
  });

  test('sandboxes SVG uploads with strict CSP and hardens PDF responses', async () => {
    (globalThis as unknown as { caches: { default: Cache } }).caches = {
      default: createMockCache(),
    };
    const env = createMockEnv({
      'assets/user-1/icon.svg': {
        body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        contentType: 'image/svg+xml',
      },
    });
    const ctx = { waitUntil() {} } as unknown as ExecutionContext;

    const res = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/icon.svg'),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox");

    // Non-media / active-adjacent downloads force Content-Disposition: attachment
    const zipEnv = createMockEnv({
      'assets/user-1/bundle.zip': {
        body: 'PK\x03\x04dummy',
        contentType: 'application/zip',
      },
    });
    const zipRes = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/bundle.zip'),
      zipEnv,
      ctx
    );
    expect(zipRes.status).toBe(200);
    expect(zipRes.headers.get('Content-Disposition')).toBe('attachment');

    // PDF assets receive strict CSP + nosniff
    const pdfEnv = createMockEnv({
      'assets/books/guide.pdf': {
        body: '%PDF-1.7 clean',
        contentType: 'application/pdf',
      },
    });
    const pdfRes = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/books/guide.pdf'),
      pdfEnv,
      ctx
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(pdfRes.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; base-uri 'none'; form-action 'none'"
    );
  });

  test('sends canonical Accept derived from explicit transform format and blocks upstream SVG from imgproxy', async () => {
    const cache = createMockCache();
    (globalThis as unknown as { caches: { default: Cache } }).caches = { default: cache };
    const env: WorkerEnv = {
      ...createMockEnv(),
      IMGPROXY_URL: 'https://img.mikeodnis.dev',
    };
    const waited: Promise<unknown>[] = [];
    const ctx = { waitUntil(p: Promise<unknown>) { waited.push(p); } } as unknown as ExecutionContext;

    const origFetch = globalThis.fetch;
    const seenAccepts: string[] = [];
    let returnSvg = false;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenAccepts.push(new Headers(init?.headers).get('Accept') || '');
      if (returnSvg) {
        return new Response('<svg/>', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
      }
      return new Response('webp-binary', { status: 200, headers: { 'Content-Type': 'image/webp' } });
    }) as typeof fetch;

    try {
      // Spoofed client Accept: image/avif must NOT be forwarded to imgproxy when format defaults to webp
      const webpRes = await worker.fetch(
        new Request('https://cdn.mikeodnis.dev/img/assets/u1/hero.png?w=400', {
          headers: { Accept: 'image/avif,text/html,*/*' },
        }),
        env,
        ctx
      );
      expect(webpRes.status).toBe(200);
      expect(webpRes.headers.get('Content-Type')).toBe('image/webp');
      expect(seenAccepts[0]).toBe('image/webp,*/*');
      await Promise.all(waited);

      // Upstream imgproxy returning image/svg+xml must be rejected with 502
      returnSvg = true;
      const svgRes = await worker.fetch(
        new Request('https://cdn.mikeodnis.dev/img/assets/u1/other.png?w=400&f=png'),
        env,
        ctx
      );
      expect(svgRes.status).toBe(502);
      expect(seenAccepts[1]).toBe('image/png,*/*');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
