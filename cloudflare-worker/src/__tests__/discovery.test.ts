import { beforeEach, describe, expect, test } from 'bun:test';
import worker, { type WorkerEnv } from '../index.js';

function createMockEnv(): WorkerEnv {
  return {
    SIGNING_SECRET: 'shared-signing-secret-32-bytes-long!!',
    R2_BUCKET_NAME: 'cdn',
    R2_BUCKET: {
      async get() {
        return null;
      },
      async head() {
        return null;
      },
    } as unknown as R2Bucket,
  };
}

describe('cdn.mikeodnis.dev Live Console, Upload Studio PWA, and LLM/Security Discovery', () => {
  const ctx = { waitUntil() {} } as unknown as ExecutionContext;

  beforeEach(() => {
    (globalThis as unknown as { caches: { default: Cache } }).caches = {
      default: {
        async match() {
          return undefined;
        },
        async put() {},
        async delete() {
          return false;
        },
      } as unknown as Cache,
    };
  });

  test('GET / renders Live Console HTML for browsers and JSON descriptor for JSON clients', async () => {
    const env = createMockEnv();

    const htmlRes = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/', { headers: { Accept: 'text/html' } }),
      env,
      ctx
    );
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get('Content-Type')).toContain('text/html');
    expect(htmlRes.headers.get('Link')).toContain('/llms.txt');
    expect(htmlRes.headers.get('Strict-Transport-Security')).toContain('preload');
    expect(htmlRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-site');
    const html = await htmlRes.text();
    expect(html).toContain('cdn.mikeodnis.dev');
    expect(html).toContain('*.mikeodnis.dev');
    expect(html).toContain('class="light-rays"');
    expect(html).toContain('/upload');
    expect(html).toContain('application/ld+json');

    const jsonRes = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/', { headers: { Accept: 'application/json' } }),
      env,
      ctx
    );
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get('Content-Type')).toContain('application/json');
    const desc = (await jsonRes.json()) as {
      service: string;
      discovery: { llms: string; security: string };
    };
    expect(desc.service).toBe('cdn.mikeodnis.dev');
    expect(desc.discovery.llms).toBe('https://cdn.mikeodnis.dev/llms.txt');
    expect(desc.discovery.security).toBe('https://cdn.mikeodnis.dev/.well-known/security.txt');
  });

  test('serves Upload Studio PWA (/upload), manifest.webmanifest with Web Share Target, sw.js, and icon.svg', async () => {
    const env = createMockEnv();

    const upload = await worker.fetch(new Request('https://cdn.mikeodnis.dev/upload'), env, ctx);
    expect(upload.status).toBe(200);
    expect(upload.headers.get('Content-Type')).toContain('text/html');
    expect(upload.headers.get('Content-Security-Policy')).toContain('https://api.mikeodnis.dev');
    const uploadHtml = await upload.text();
    expect(uploadHtml).toContain('Upload Studio');
    expect(uploadHtml).toContain('/v1/media/upload');
    // Session epoch guard prevents an in-flight token refresh from resurrecting a logged-out session
    expect(uploadHtml).toContain('sessionEpoch !== startEpoch');

    const manifestRes = await worker.fetch(
      new Request('https://cdn.mikeodnis.dev/manifest.webmanifest'),
      env,
      ctx
    );
    expect(manifestRes.status).toBe(200);
    const manifest = (await manifestRes.json()) as {
      start_url: string;
      share_target: { action: string; method: string };
    };
    expect(manifest.start_url).toBe('/upload');
    expect(manifest.share_target.action).toBe('/upload-share');
    expect(manifest.share_target.method).toBe('POST');

    const sw = await worker.fetch(new Request('https://cdn.mikeodnis.dev/sw.js'), env, ctx);
    expect(sw.status).toBe(200);
    expect(sw.headers.get('Content-Type')).toContain('javascript');
    const swBody = await sw.text();
    expect(swBody).toContain('/upload-share');
    expect(swBody).toContain('url.origin !== self.location.origin');

    const icon = await worker.fetch(new Request('https://cdn.mikeodnis.dev/icon.svg'), env, ctx);
    expect(icon.status).toBe(200);
    expect(icon.headers.get('Content-Type')).toContain('image/svg+xml');

    for (const [assetPath, mime] of [
      ['/favicon.ico', 'image/x-icon'],
      ['/apple-touch-icon.png', 'image/png'],
      ['/icon-192.png', 'image/png'],
      ['/icon-512.png', 'image/png'],
      ['/opengraph-image', 'image/png'],
      ['/opengraph-image.png', 'image/png'],
      ['/twitter-image.png', 'image/png'],
    ] as const) {
      const res = await worker.fetch(new Request(`https://cdn.mikeodnis.dev${assetPath}`), env, ctx);
      expect(res.status, assetPath).toBe(200);
      expect(res.headers.get('Content-Type'), assetPath).toBe(mime);
      expect(res.headers.get('Cross-Origin-Resource-Policy'), assetPath).toBe('cross-origin');
      expect((await res.arrayBuffer()).byteLength, assetPath).toBeGreaterThan(500);
    }
  });

  test('serves llms.txt, llms-full.txt, security.txt, robots.txt, sitemap.xml, and openapi.yaml with HEAD support', async () => {
    const env = createMockEnv();

    const routes: Array<[string, string, string]> = [
      ['/llms.txt', 'text/markdown', '# cdn.mikeodnis.dev'],
      ['/llms-full.txt', 'text/markdown', 'HMAC-SHA256'],
      ['/docs', 'text/html', '@scalar/api-reference'],
      ['/.well-known/security.txt', 'text/plain', 'Contact: mailto:mike@mikeodnis.dev'],
      ['/.well-known/assetlinks.json', 'application/json', 'dev.mikeodnis.cdn'],
      ['/robots.txt', 'text/plain', 'Sitemap: https://cdn.mikeodnis.dev/sitemap.xml'],
      ['/sitemap.xml', 'application/xml', '<loc>https://cdn.mikeodnis.dev/upload</loc>'],
      ['/openapi.yaml', 'application/yaml', 'openapi: 3.1.0'],
    ];

    for (const [path, mime, snippet] of routes) {
      const res = await worker.fetch(new Request(`https://cdn.mikeodnis.dev${path}`), env, ctx);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('Content-Type'), path).toContain(mime);
      expect(await res.text(), path).toContain(snippet);

      const head = await worker.fetch(
        new Request(`https://cdn.mikeodnis.dev${path}`, { method: 'HEAD' }),
        env,
        ctx
      );
      expect(head.status, `HEAD ${path}`).toBe(200);
      expect(await head.text(), `HEAD ${path}`).toBe('');
    }
  });
});
