import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import worker from './cdn-worker.js';

function createMockCache() {
  const store = new Map();
  return {
    async match(req) {
      return store.get(typeof req === 'string' ? req : req.url);
    },
    async put(req, res) {
      store.set(typeof req === 'string' ? req : req.url, res);
    },
  };
}

function createMockEnv(objects = {}) {
  return {
    SIGNING_SECRET: 'shared-signing-secret-32-bytes-long!!',
    R2_BUCKET_NAME: 'mikeodnis-cdn',
    R2_BUCKET: {
      async get(key) {
        const entry = objects[key];
        if (!entry) return null;
        return {
          body: entry.body,
          size: entry.body.length,
          httpEtag: '"etag-abc"',
          writeHttpMetadata(headers) {
            headers.set('Content-Type', entry.contentType || 'application/octet-stream');
          },
        };
      },
      async head(key) {
        const entry = objects[key];
        if (!entry) return null;
        return {
          size: entry.body.length,
          httpEtag: '"etag-abc"',
          writeHttpMetadata(headers) {
            headers.set('Content-Type', entry.contentType || 'application/octet-stream');
          },
        };
      },
    },
  };
}

function signLikeGoMediaService(secret, path, expUnix) {
  return createHmac('sha256', secret)
    .update(`${path}:${expUnix}`)
    .digest('base64url');
}

describe('cdn-worker (cdn.mikeodnis.dev)', () => {
  globalThis.caches = { default: createMockCache() };

  test('health and OPTIONS CORS preflight', async () => {
    const env = createMockEnv();
    const ctx = { waitUntil() {} };

    const health = await worker.fetch(new Request('https://cdn.mikeodnis.dev/health'), env, ctx);
    expect(health.status).toBe(200);
    expect((await health.json()).status).toBe('healthy');

    const opts = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/u1/img.png', { method: 'OPTIONS' }),
      env,
      ctx
    );
    expect(opts.status).toBe(204);
    expect(opts.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('serves public R2 asset under /assets/ with immutable cache headers', async () => {
    const env = createMockEnv({
      'assets/user-1/logo.png': { body: 'png-bytes', contentType: 'image/png' },
    });
    const waited = [];
    const ctx = { waitUntil(p) { waited.push(p); } };

    const res = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/logo.png'),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(await res.text()).toBe('png-bytes');
    expect(waited.length).toBe(1);
    await Promise.all(waited);
  });

  test('validates Go media-service HMAC signatures on /private/ assets', async () => {
    const env = createMockEnv({
      'private/user-1/invoice.pdf': { body: 'pdf-secret', contentType: 'application/pdf' },
    });
    const ctx = { waitUntil() {} };
    const path = '/private/user-1/invoice.pdf';
    const futureExp = Math.floor(Date.now() / 1000) + 300;
    const validSig = signLikeGoMediaService(env.SIGNING_SECRET, path, futureExp);

    // Valid signature -> 200
    const ok = await worker.fetch(
      new Request(`https://cdn.mikeodnis.dev${path}?exp=${futureExp}&sig=${validSig}`),
      env,
      ctx
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toContain('private');
    expect(await ok.text()).toBe('pdf-secret');

    // Tampered signature -> 403
    const badSig = await worker.fetch(
      new Request(`https://cdn.mikeodnis.dev${path}?exp=${futureExp}&sig=${validSig}x`),
      env,
      ctx
    );
    expect(badSig.status).toBe(403);

    // Expired signature -> 403
    const pastExp = Math.floor(Date.now() / 1000) - 10;
    const expiredSig = signLikeGoMediaService(env.SIGNING_SECRET, path, pastExp);
    const expired = await worker.fetch(
      new Request(`https://cdn.mikeodnis.dev${path}?exp=${pastExp}&sig=${expiredSig}`),
      env,
      ctx
    );
    expect(expired.status).toBe(403);

    // Normalized path traversal routes to /private/ and is rejected with 403
    const normalizedTraversal = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/../private/user-1/invoice.pdf'),
      env,
      ctx
    );
    expect(normalizedTraversal.status).toBe(403);

    // Raw '..' in key is rejected with 400
    const badKey = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/assets/user-1/foo..bar.png'),
      env,
      ctx
    );
    expect(badKey.status).toBe(400);
  });
});
