import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { GEIST_MONO_WOFF2, GEIST_OFL_TXT, GEIST_WOFF2 } from '../api/brandFonts.js';
import { ICON_SPRITE_SVG, SUBDOMAIN_CSS } from '../api/subdomainDesign.js';
import worker, { type WorkerEnv } from '../index.js';

const ORIGIN = 'https://cdn.mikeodnis.dev';
const API = 'https://api.mikeodnis.dev';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const FONT_PATHS = [
  '/_brand/fonts/geist-v1.9-latin.woff2',
  '/_brand/fonts/geist-mono-v1.9-latin.woff2',
] as const;
const NEW_TAB = '(opens in a new tab)';

// SHA-256 of the shared design files (subdomain spec v1). api.mikeodnis.dev ships the same bytes,
// so a change here must land in the shared file first and then on both sites.
const SHARED_SHA256 = {
  css: 'bfbe620cd8e9879fcb20468b24b68e41248e99eb6f1c39609437e60b89ba44d2',
  sprite: '874048941c33aa2a176eb1a6dffb2daeef0d443c5b47c0ffbc9901ffc9aa2519',
  geist: '3da227e69973664cb9bb1e8098b6788451fe6567cabb89b9a1c48e8e9938ed76',
  geistMono: 'd9b43cf57f8c3c4b29a43f95648fb090b8872430dff6a7290d7e4aef9a81c88c',
  ofl: '930853ee1daa68554d9e35c8a9175affb74f699fad9a5da6ee5ebe76379d9137',
} as const;

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

const ctx = { waitUntil() {} } as unknown as ExecutionContext;

function fetchPath(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init), createMockEnv(), ctx);
}

async function homeHtml(): Promise<string> {
  const res = await fetchPath('/', { headers: { Accept: 'text/html' } });
  expect(res.status).toBe(200);
  return res.text();
}

function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

type Attrs = Record<string, string>;

/** Collects the attributes of every element matching `selector` (Bun ships HTMLRewriter). */
async function collect(html: string, selector: string): Promise<Attrs[]> {
  const found: Attrs[] = [];
  await new HTMLRewriter()
    .on(selector, {
      element(el) {
        found.push(Object.fromEntries(Array.from(el.attributes, (a) => [a[0] ?? '', a[1] ?? ''])));
      },
    })
    .transform(new Response(html))
    .text();
  return found;
}

/** Every `<a …>…</a>` with its attributes and inner HTML (anchors never nest). */
function anchors(html: string): Array<{ attrs: string; inner: string }> {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    attrs: m[1] ?? '',
    inner: m[2] ?? '',
  }));
}

function parseCsp(header: string): Map<string, string[]> {
  return new Map(
    header
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map((parts) => [parts[0] ?? '', parts.slice(1)])
  );
}

describe('cdn.mikeodnis.dev root on the shared subdomain design', () => {
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

  describe('brand fonts at /_brand/fonts/', () => {
    test('serves both Geist woff2 files same-origin with immutable caching', async () => {
      for (const path of FONT_PATHS) {
        const res = await fetchPath(path);
        expect(res.status, path).toBe(200);
        expect(res.headers.get('Content-Type'), path).toBe('font/woff2');
        expect(res.headers.get('Cache-Control'), path).toBe(IMMUTABLE);
        expect(res.headers.get('X-Content-Type-Options'), path).toBe('nosniff');
        const bytes = new Uint8Array(await res.arrayBuffer());
        expect(bytes.byteLength, path).toBeGreaterThan(10_000);
        expect(res.headers.get('Content-Length'), path).toBe(String(bytes.byteLength));
        expect(new TextDecoder().decode(bytes.subarray(0, 4)), path).toBe('wOF2');
      }
    });

    test('answers HEAD with headers and no body', async () => {
      for (const path of FONT_PATHS) {
        const res = await fetchPath(path, { method: 'HEAD' });
        expect(res.status, path).toBe(200);
        expect(res.headers.get('Content-Type'), path).toBe('font/woff2');
        expect(res.headers.get('Cache-Control'), path).toBe(IMMUTABLE);
        expect(await res.text(), path).toBe('');
      }
    });

    test('ships the OFL licence next to the fonts', async () => {
      const res = await fetchPath('/_brand/fonts/OFL.txt');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(await res.text()).toContain('SIL Open Font License, Version 1.1');
    });

    test('returns 404 for font files it does not ship', async () => {
      const res = await fetchPath('/_brand/fonts/geist-v2.0-latin.woff2');
      expect(res.status).toBe(404);
    });

    test('carries the shared design files byte for byte', () => {
      expect(sha256(SUBDOMAIN_CSS)).toBe(SHARED_SHA256.css);
      expect(sha256(ICON_SPRITE_SVG)).toBe(SHARED_SHA256.sprite);
      expect(sha256(GEIST_WOFF2)).toBe(SHARED_SHA256.geist);
      expect(sha256(GEIST_MONO_WOFF2)).toBe(SHARED_SHA256.geistMono);
      expect(sha256(GEIST_OFL_TXT)).toBe(SHARED_SHA256.ofl);
    });
  });

  describe('GET / document', () => {
    test('CSP loads fonts and the inline stylesheet from self only', async () => {
      const res = await fetchPath('/', { headers: { Accept: 'text/html' } });
      const csp = parseCsp(res.headers.get('Content-Security-Policy') ?? '');
      expect(csp.get('default-src')).toEqual(["'self'"]);
      expect(csp.get('font-src')).toEqual(["'self'"]);
      expect(csp.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
      expect(csp.get('connect-src')).toEqual(["'self'"]);
      expect(csp.get('object-src')).toEqual(["'none'"]);
      expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    });

    test('inlines the shared stylesheet and preloads Geist', async () => {
      const html = await homeHtml();
      expect(html).toContain(`<style>${SUBDOMAIN_CSS}</style>`);
      // The CSS mentions "<style>" in a comment, so count closing tags.
      expect(count(html, '</style>')).toBe(1);
      expect(html).not.toContain('rel="stylesheet"');
      expect(html).toContain(
        '<link rel="preload" href="/_brand/fonts/geist-v1.9-latin.woff2" as="font" type="font/woff2" crossorigin />'
      );
      expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic|jsdelivr/);
    });

    test('every font the stylesheet references is served by the worker', async () => {
      const html = await homeHtml();
      const urls = [...html.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
      expect(new Set(urls)).toEqual(new Set(FONT_PATHS));
      for (const path of FONT_PATHS) {
        const res = await fetchPath(path);
        expect(res.status, path).toBe(200);
        expect(res.headers.get('Content-Type'), path).toBe('font/woff2');
      }
    });

    test('titles follow the "Name - Mike Odnis" convention with no em dash anywhere', async () => {
      const html = await homeHtml();
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<title>CDN - Mike Odnis</title>');
      for (const name of ['og:site_name', 'og:title']) {
        expect(html).toContain(`<meta property="${name}" content="CDN - Mike Odnis" />`);
      }
      expect(html).toContain('<meta name="twitter:title" content="CDN - Mike Odnis" />');
      expect(html).toContain('<meta property="og:locale" content="en_US" />');
      expect(html).toMatch(/<meta property="og:image:alt" content="CDN - Mike Odnis\. [^"]+" \/>/);
      expect(html).toMatch(/<meta name="twitter:image:alt" content="CDN - Mike Odnis\. [^"]+" \/>/);
      expect(html).toContain('<meta name="theme-color" content="#0c0c14" />');
      expect(html).not.toContain('—');
    });

    test('keeps the head links, JSON-LD and Link header', async () => {
      const res = await fetchPath('/', { headers: { Accept: 'text/html' } });
      expect(res.headers.get('Link')).toContain('/llms.txt');
      const html = await res.text();
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/" />`);
      expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
      expect(html).toContain('rel="describedby"');
      expect(html).toContain('rel="service-desc"');
      expect(html).toContain('<script type="application/ld+json">');
      expect(html).toContain('"@type":"FAQPage"');
    });
  });

  describe('GET / chrome (rail, bottom bar, one popover menu, footer)', () => {
    test('skip link targets main and the sprite defines every icon used', async () => {
      const html = await homeHtml();
      expect(html.indexOf('<a class="skip-link" href="#main">')).toBeLessThan(
        html.indexOf('<svg class="icon-sprite"')
      );
      expect(html).toContain('<main id="main" class="shell" tabindex="-1">');
      const used = new Set([...html.matchAll(/<use href="#(i-[a-z0-9-]+)"/g)].map((m) => m[1]));
      const defined = new Set([...html.matchAll(/<symbol id="(i-[a-z0-9-]+)"/g)].map((m) => m[1]));
      expect(used.size).toBeGreaterThan(10);
      for (const id of used) expect(defined.has(id), id).toBe(true);
    });

    test('rail has home, reference, Upload Studio, network and source items', async () => {
      const html = await homeHtml();
      const items = await collect(html, '.rail .rail-item');
      expect(items.map((a) => a['aria-label'])).toEqual([
        'Home',
        'CDN reference',
        'Upload Studio',
        'Network: *.mikeodnis.dev',
        `Source on GitHub ${NEW_TAB}`,
      ]);
      expect(items[0]?.['aria-current']).toBe('page');
      expect(items[3]?.['popovertarget']).toBe('site-menu');
      expect(items[4]?.['href']).toBe('https://github.com/WomB0ComB0/cdn');
    });

    test('one popover serves as the network flyout and the phone menu', async () => {
      const html = await homeHtml();
      const popovers = await collect(html, '[popover]');
      expect(popovers).toHaveLength(1);
      expect(popovers[0]?.['id']).toBe('site-menu');
      // A labelled container needs a role (aria-labelledby is prohibited on a bare div), and a
      // dialog also gives the sheet's heading and close button a valid home (axe "region").
      expect(popovers[0]?.['role']).toBe('dialog');
      expect(popovers[0]?.['aria-labelledby']).toBe('site-menu-title');
      const invokers = await collect(html, '[popovertarget]');
      expect(invokers.every((b) => b['popovertarget'] === 'site-menu')).toBe(true);
      expect(invokers.length).toBeGreaterThanOrEqual(3);
      // Accessible names start with the visible label (WCAG 2.5.3): "Menu", "Docs".
      const bar = await collect(html, '.mobile-bar .bar-btn');
      expect(bar.map((b) => b['aria-label'])).toEqual([
        'Open navigation menu',
        'Docs: CDN reference',
      ]);

      const network = await collect(html, '#site-menu [aria-labelledby="menu-network"] .menu-link');
      expect(network.map((a) => a['href'])).toEqual([
        'https://mikeodnis.dev',
        'https://links.mikeodnis.dev',
        'https://blog.mikeodnis.dev',
        'https://news.mikeodnis.dev',
        API,
        '/',
        'https://status.mikeodnis.dev',
        'https://mikeodnis.dev/sponsor',
      ]);
      expect(network[5]?.['aria-current']).toBe('page');
      const ventures = await collect(html, '#site-menu [aria-labelledby="menu-ventures"] .menu-link');
      expect(ventures.map((a) => a['href'])).toEqual(['https://elysium.tools', 'https://atroviola.com']);
    });

    test('ids are unique and every aria-labelledby resolves', async () => {
      const html = await homeHtml();
      const ids = (await collect(html, '[id]')).map((e) => e['id']);
      expect(new Set(ids).size).toBe(ids.length);
      for (const el of await collect(html, '[aria-labelledby]')) {
        expect(ids, el['aria-labelledby']).toContain(el['aria-labelledby']);
      }
    });

    test('footer carries licence, repo, ecosystem links and the Status pill', async () => {
      const html = await homeHtml();
      const footer = html.slice(html.indexOf('<footer class="site-footer">'));
      expect(footer).toContain('https://github.com/WomB0ComB0/cdn/blob/main/LICENSE');
      expect(footer).toContain('2025-present &#169;');
      expect(footer).toContain('>WomB0ComB0/cdn<');
      const nav = await collect(footer, '.footer-nav .footer-link');
      expect(nav.map((a) => a['href'])).toEqual([
        'https://mikeodnis.dev',
        'https://links.mikeodnis.dev',
        'https://blog.mikeodnis.dev',
        'https://news.mikeodnis.dev',
        API,
        'https://elysium.tools',
      ]);
      const pill = await collect(html, 'a.status-pill');
      expect(pill).toHaveLength(1);
      expect(pill[0]?.['href']).toBe('https://status.mikeodnis.dev');
      expect(pill[0]?.['data-tone']).toBe('idle');
    });

    test('every link to another origin opens a new tab safely and says so', async () => {
      const html = await homeHtml();
      const external = anchors(html).filter((a) => /href="https?:\/\//.test(a.attrs));
      expect(external.length).toBeGreaterThan(20);
      for (const a of external) {
        expect(a.attrs, a.attrs).toContain('target="_blank"');
        expect(a.attrs, a.attrs).toContain('rel="noopener noreferrer"');
        const announced =
          a.attrs.includes(NEW_TAB) || a.inner.includes(`<span class="sr-only"> ${NEW_TAB}</span>`);
        expect(announced, a.attrs).toBe(true);
      }
      for (const a of anchors(html).filter((x) => /href="\//.test(x.attrs))) {
        expect(a.attrs, a.attrs).not.toContain('target=');
      }
    });
  });

  describe('GET / content blocks', () => {
    test('page header: eyebrow, title, one primary action, live status readout', async () => {
      const html = await homeHtml();
      expect(html).toContain('<p class="page-eyebrow">cdn.mikeodnis.dev</p>');
      expect(html).toContain('<h1 class="page-title">CDN</h1>');
      expect(html).toContain(
        '<p class="page-stack">Edge asset delivery&nbsp;· Cloudflare Workers + R2</p>'
      );
      const primary = await collect(html, '.btn-primary');
      expect(primary).toHaveLength(1);
      expect(primary[0]?.['href']).toBe('/upload');
      const actions = await collect(html, '.actions .btn');
      expect(actions.map((a) => a['href'])).toEqual([
        '/upload',
        '/docs',
        `${API}/docs`,
        '/llms.txt',
        '/openapi.yaml',
      ]);
      const status = await collect(html, '.page-header p.status');
      expect(status).toHaveLength(1);
      expect(status[0]?.['role']).toBe('status');
      expect(status[0]?.['data-tone']).toBe('idle');
      expect(html).not.toMatch(/→/);
    });

    test('edge capabilities, route table, quick start, discovery and FAQ keep their content', async () => {
      const html = await homeHtml();
      expect(await collect(html, '.card-row > li.tile.card')).toHaveLength(3);
      for (const [label, figure] of [
        ['Public assets', '300'],
        ['Private signed', '120'],
        ['Image transforms', '60'],
      ]) {
        expect(html).toContain(`<p class="card-label">${label}</p>`);
        expect(html).toContain(`<span class="card-figure">${figure}</span>`);
      }

      expect(await collect(html, '.ref-table tbody tr')).toHaveLength(5);
      expect(count(html, '<span class="badge">GET</span>')).toBe(5);
      expect(html).toContain('<p class="section-meta">5 routes</p>');
      for (const path of [
        '<code>/assets/{key}</code>',
        '<code>/private/{key}?exp=&amp;sig=</code>',
        '<code>/img/assets/{key}?w=&amp;h=&amp;q=&amp;f=</code>',
        '<code>/upload</code>',
        '<code>/health/metrics</code>',
      ]) {
        expect(html).toContain(path);
      }
      // HTMLRewriter hands back attribute values as written, entities included.
      const labelled = await collect(html, '.ref-table td[data-label]');
      expect(new Set(labelled.map((td) => td['data-label']))).toEqual(
        new Set(['Auth', 'Behavior &amp; cache'])
      );

      expect(await collect(html, 'pre.code[tabindex="0"]')).toHaveLength(2);
      expect(html).toContain(`curl -X POST ${API}/v1/media/upload \\\n`);
      expect(html).toContain(`curl -I ${ORIGIN}/assets/demo/avatar.png`);

      expect(await collect(html, 'ul.discovery > li')).toHaveLength(6);

      const faq = await collect(html, 'details.faq-item');
      expect(faq).toHaveLength(3);
      expect('open' in (faq[0] ?? {})).toBe(true);
      expect('open' in (faq[1] ?? {})).toBe(false);
      for (const q of [
        'How are uploads, SVGs, and active files protected against XSS?',
        'How do I install Upload Studio on Android or Desktop?',
        'What rate-limit headers does the CDN return?',
      ]) {
        expect(html).toContain(`<summary>${q}</summary>`);
      }
    });

    test('keeps every link the previous page had', async () => {
      const html = await homeHtml();
      const hrefs = new Set((await collect(html, 'a[href]')).map((a) => a['href']));
      for (const href of [
        '/upload',
        '/docs',
        `${API}/docs`,
        '/llms.txt',
        '/llms-full.txt',
        '/openapi.yaml',
        '/.well-known/security.txt',
        '/robots.txt',
        '/sitemap.xml',
        '/manifest.webmanifest',
        'https://mikeodnis.dev',
        'https://links.mikeodnis.dev',
        'https://blog.mikeodnis.dev',
        'https://news.mikeodnis.dev',
        API,
        'https://status.mikeodnis.dev',
        'https://mikeodnis.dev/sponsor',
        'https://github.com/WomB0ComB0/cdn',
      ]) {
        expect(hrefs.has(href), href).toBe(true);
      }
    });

    test('the status probe hits /health/metrics and writes text only', async () => {
      const html = await homeHtml();
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
      expect(scripts).toHaveLength(1);
      const probe = scripts[0] ?? '';
      expect(probe).toContain("fetch('/health/metrics'");
      expect(probe).toContain('textContent');
      expect(probe).not.toContain('innerHTML');
    });

    test('drops the legacy Live Console markup and inline styles from the root only', async () => {
      const html = await homeHtml();
      expect(html).not.toContain('class="constellation"');
      expect(html).not.toContain('label-mono');
      expect(html).not.toMatch(/\sstyle="/);

      const upload = await (await fetchPath('/upload')).text();
      expect(upload).toContain('class="constellation"');
      expect(upload).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    });
  });

  test('subpage titles use the "Page - CDN" form under the "CDN - Mike Odnis" site name', async () => {
    const siteName = '<meta property="og:site_name" content="CDN - Mike Odnis" />';
    const docs = await (await fetchPath('/docs')).text();
    expect(docs).toContain('<title>Reference - CDN</title>');
    expect(docs).toContain(siteName);
    expect(docs).not.toContain('—');
    const upload = await (await fetchPath('/upload')).text();
    expect(upload).toContain('<title>Upload Studio - CDN</title>');
    expect(upload).toContain(siteName);
  });
});
