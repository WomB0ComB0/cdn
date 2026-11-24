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
  });

  test('sandboxes SVG uploads with strict CSP to prevent Stored XSS', async () => {
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
  });
});
