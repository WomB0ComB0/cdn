import { API_ORIGIN, CDN_ORIGIN } from './discovery.js';

export const CDN_MANIFEST_JSON = JSON.stringify(
  {
    id: '/upload',
    name: 'Mike CDN — Upload Studio',
    short_name: 'Mike CDN',
    description:
      'Upload, optimize, sign, and manage assets on cdn.mikeodnis.dev from mobile or desktop.',
    start_url: '/upload',
    scope: '/',
    display: 'standalone',
    background_color: '#0c0c14',
    theme_color: '#0c0c14',
    categories: ['utilities', 'productivity', 'developer'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    share_target: {
      action: '/upload-share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        files: [
          {
            name: 'file',
            accept: ['image/*', 'video/*', 'audio/*', 'application/pdf', '*/*'],
          },
        ],
      },
    },
  },
  null,
  2
);

export const CDN_SW_JS = `const SHELL_CACHE = 'mike-cdn-shell-v1';
const SHARE_CACHE = 'mike-cdn-share-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/upload', '/manifest.webmanifest', '/icon.svg'])).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Android / Desktop Web Share Target handoff: stash shared file in Cache API and open /upload?shared=1
  if (event.request.method === 'POST' && url.pathname === '/upload-share') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');
        if (file && typeof file === 'object' && 'arrayBuffer' in file && file.size > 0 && file.size <= 100 * 1024 * 1024) {
          const cache = await caches.open(SHARE_CACHE);
          const buf = await file.arrayBuffer();
          const headers = new Headers({
            'Content-Type': file.type || 'application/octet-stream',
            'X-Shared-Filename': encodeURIComponent(file.name || 'shared-upload'),
          });
          await cache.put('/_shared-file', new Response(buf, { headers }));
        }
      } catch {
        // Ignore share parse failure and still open /upload
      }
      return Response.redirect('/upload?shared=1', 303);
    })());
    return;
  }

  if (event.request.method === 'GET' && (url.pathname === '/upload' || url.pathname === '/icon.svg' || url.pathname === '/manifest.webmanifest')) {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match(event.request)) || new Response('Offline', { status: 503 }))
    );
  }
});
`;

const LIVE_CONSOLE_CSS = `:root {
  color-scheme: dark;
  --light-rays: rgb(88 68 188);
  --canvas: #0c0c14;
  --surface-1: rgba(17, 17, 28, 0.86);
  --surface-2: #161625;
  --surface-3: #1e1e32;
  --hairline: rgba(255, 255, 255, 0.08);
  --hairline-strong: rgba(255, 255, 255, 0.16);
  --fg: #f4f4f8;
  --muted: #a1a1b5;
  --faint: #71718a;
  --brand: #a78bfa;
  --brand-ink: #c4b5fd;
  --brand-subtle: rgba(167, 139, 250, 0.14);
  --live: #34d399;
  --live-tint: rgba(52, 211, 153, 0.12);
  --warn: #fbbf24;
  --down: #f87171;
  --radius: 14px;
  --font-sans: 'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: var(--canvas);
  color: var(--fg);
  font-family: var(--font-sans);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
body {
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
}
.light-glows {
  background-image:
    radial-gradient(circle at 20% 15%, rgba(88, 68, 188, 0.054), transparent 70%),
    radial-gradient(circle at 80% 10%, rgba(88, 68, 188, 0.042), transparent 75%);
  background-image:
    radial-gradient(circle at 20% 15%, oklch(from var(--light-rays) l c h / 5.4%), transparent 70%),
    radial-gradient(circle at 80% 10%, oklch(from var(--light-rays) l c h / 4.2%), transparent 75%);
}
.light-rays {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.light-rays > i {
  --ray-cycle: calc(var(--ray-duration) * 1.1);
  position: absolute;
  top: -12%;
  left: var(--ray-left);
  width: var(--ray-width);
  height: 70vh;
  border-radius: 9999px;
  background: linear-gradient(to bottom, rgba(88, 68, 188, 0.14), transparent);
  background: linear-gradient(to bottom, oklch(from var(--light-rays) l c h / 14%), transparent);
  filter: blur(20px);
  opacity: 0;
  translate: -50% 0;
  rotate: var(--ray-rotate);
  transform-origin: 50% 0;
  animation: light-ray var(--ray-cycle) ease-in-out calc(var(--ray-delay) - var(--ray-cycle)) infinite;
}
@keyframes light-ray {
  0% { opacity: 0; rotate: calc(var(--ray-rotate) - var(--ray-swing)); }
  45.45% { opacity: var(--ray-peak); rotate: calc(var(--ray-rotate) + var(--ray-swing)); }
  90.91%, 100% { opacity: 0; rotate: calc(var(--ray-rotate) - var(--ray-swing)); }
}
@media (prefers-reduced-motion: reduce) {
  .light-rays > i {
    animation-name: none !important;
    opacity: calc(var(--ray-peak) * 0.6);
  }
}
@media (forced-colors: active), print {
  .light-glows { background-image: none; }
  .light-rays { display: none; }
}
a { color: var(--brand-ink); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 4px; text-decoration-style: dotted; }
code, pre, kbd { font-family: var(--font-mono); }
.shell { max-width: 1080px; margin: 0 auto; padding: 1.25rem 1.25rem 4rem; }
.constellation {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.65rem 0.9rem; margin-bottom: 1.75rem;
  background: rgba(17, 17, 28, 0.85); border: 1px solid var(--hairline); border-radius: var(--radius);
  backdrop-filter: blur(12px);
}
.constellation-links { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; font-size: 0.82rem; }
.constellation-links a, .constellation-links span.here {
  padding: 0.3rem 0.6rem; border-radius: 8px; color: var(--muted); transition: background 140ms, color 140ms;
}
.constellation-links a:hover { background: var(--surface-3); color: var(--fg); text-decoration: none; }
.constellation-links span.here { background: var(--brand-subtle); color: var(--brand-ink); font-weight: 600; }
.label-mono {
  font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint);
}
.tile {
  background: var(--surface-1); border: 1px solid var(--hairline); border-radius: var(--radius); padding: 1.25rem;
  backdrop-filter: blur(8px);
}
.tile:hover { border-color: var(--hairline-strong); }
.grid { display: grid; gap: 1rem; }
.grid-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.grid-3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.hero { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1.25rem; margin-bottom: 1rem; }
h1 { margin: 0.35rem 0 0.5rem; font-size: clamp(1.65rem, 3.2vw, 2.35rem); letter-spacing: -0.025em; line-height: 1.15; }
h2 { margin: 0 0 0.75rem; font-size: 1.05rem; letter-spacing: -0.01em; }
p { margin: 0 0 0.75rem; color: var(--muted); font-size: 0.94rem; }
.pill {
  display: inline-flex; align-items: center; gap: 0.45rem;
  font-family: var(--font-mono); font-size: 0.75rem;
  padding: 0.25rem 0.65rem; border-radius: 999px;
  border: 1px solid rgba(52, 211, 153, 0.3); background: var(--live-tint); color: var(--live);
}
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--live); box-shadow: 0 0 10px var(--live); }
.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1rem; }
.btn {
  display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer;
  font-family: var(--font-sans); font-size: 0.86rem; font-weight: 500;
  padding: 0.55rem 0.95rem; border-radius: 10px;
  border: 1px solid var(--hairline-strong); background: var(--surface-2); color: var(--fg);
  transition: background 140ms, border-color 140ms;
}
.btn:hover { background: var(--surface-3); text-decoration: none; }
.btn-brand { background: var(--brand-subtle); border-color: rgba(167, 139, 250, 0.45); color: var(--brand-ink); }
.btn-brand:hover { background: rgba(167, 139, 250, 0.22); }
.btn-sm { padding: 0.35rem 0.65rem; font-size: 0.78rem; border-radius: 8px; }
.btn-danger { border-color: rgba(248, 113, 113, 0.35); color: var(--down); }
.btn-danger:hover { background: rgba(248, 113, 113, 0.12); }
.stat-val { font-family: var(--font-mono); font-size: 1.35rem; font-weight: 600; color: var(--fg); margin-top: 0.25rem; }
.stat-sub { font-size: 0.8rem; color: var(--faint); margin-top: 0.2rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
th, td { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 1px solid var(--hairline); vertical-align: top; }
th { font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); font-weight: 500; }
.method {
  display: inline-block; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600;
  padding: 0.15rem 0.45rem; border-radius: 6px; background: var(--brand-subtle); color: var(--brand-ink);
}
pre {
  margin: 0.5rem 0 0; padding: 0.9rem 1rem; overflow-x: auto;
  background: var(--canvas); border: 1px solid var(--hairline); border-radius: 10px;
  font-size: 0.8rem; color: #e2e8f0;
}
.faq details { border-bottom: 1px solid var(--hairline); padding: 0.75rem 0; }
.faq details:last-child { border-bottom: 0; }
.faq summary { cursor: pointer; font-weight: 500; color: var(--fg); font-size: 0.92rem; }
.faq details p { margin: 0.5rem 0 0; }
footer {
  margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--hairline);
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.75rem; font-size: 0.8rem; color: var(--faint);
}
`;

const LIGHT_RAYS_HTML = `<div class="light-rays" aria-hidden="true">
    <i style="--ray-left:90.5%;--ray-width:221px;--ray-rotate:-7.9deg;--ray-swing:2.5deg;--ray-duration:12s;--ray-delay:12.2s;--ray-peak:0.84"></i>
    <i style="--ray-left:21.7%;--ray-width:272px;--ray-rotate:-24deg;--ray-swing:2deg;--ray-duration:17.2s;--ray-delay:4.7s;--ray-peak:0.72"></i>
    <i style="--ray-left:38.8%;--ray-width:307px;--ray-rotate:10.6deg;--ray-swing:1.1deg;--ray-duration:16.5s;--ray-delay:11.6s;--ray-peak:0.73"></i>
    <i style="--ray-left:53.5%;--ray-width:271px;--ray-rotate:16deg;--ray-swing:1.9deg;--ray-duration:15s;--ray-delay:2.9s;--ray-peak:0.86"></i>
    <i style="--ray-left:20.6%;--ray-width:258px;--ray-rotate:12.4deg;--ray-swing:1.9deg;--ray-duration:15.1s;--ray-delay:1.3s;--ray-peak:0.81"></i>
  </div>`;

export function renderCdnDocsPage(): string {
  const config = JSON.stringify({
    url: '/openapi.yaml',
    theme: 'deepSpace',
    darkMode: true,
    metaData: {
      title: 'Reference - CDN',
    },
  });

  return `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reference - CDN</title>
  <meta name="description" content="Interactive OpenAPI 3.1 reference for cdn.mikeodnis.dev: public R2 assets, HMAC-signed private files, and on-the-fly AVIF/WebP image transforms." />
  <meta name="theme-color" content="#0c0c14" />
  <link rel="canonical" href="${CDN_ORIGIN}/docs" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="describedby" type="text/markdown" href="/llms.txt" />
  <link rel="service-desc" type="application/yaml" href="/openapi.yaml" />
  <meta property="og:site_name" content="CDN - Mike Odnis" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${CDN_ORIGIN}/docs" />
  <meta property="og:title" content="Reference - CDN" />
  <meta property="og:description" content="Interactive OpenAPI 3.1 reference for cdn.mikeodnis.dev." />
  <meta property="og:image" content="${CDN_ORIGIN}/opengraph-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${CDN_ORIGIN}/twitter-image.png" />
  <style>
    body { margin: 0; background: #0c0c14; }
  </style>
</head>
<body>
  <script id="api-reference" data-configuration='${config}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js" crossorigin></script>
</body>
</html>`;
}

/**
 * The Upload Studio PWA. Its inline script lives in this template literal, so every backslash in
 * the script is written doubled (`\\s`) to reach the browser as one; a single `\s` would arrive as
 * `s` and leave the script unparseable. Not String.raw: the bundler rewrites non-ASCII characters
 * in templates as \u escapes, which String.raw would then print literally. Guarded by
 * uploadStudioScript.test.ts.
 */
export function renderUploadStudioPage(): string {
  return `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Upload Studio - CDN</title>
  <meta name="description" content="Installable PWA for uploading, signing, transforming, and managing R2 assets on cdn.mikeodnis.dev from mobile or desktop." />
  <meta name="theme-color" content="#0c0c14" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="canonical" href="${CDN_ORIGIN}/upload" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta property="og:site_name" content="CDN - Mike Odnis" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${CDN_ORIGIN}/upload" />
  <meta property="og:title" content="Upload Studio - CDN" />
  <meta property="og:description" content="Installable PWA for uploading, signing, transforming, and managing R2 assets on cdn.mikeodnis.dev." />
  <meta property="og:image" content="${CDN_ORIGIN}/opengraph-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${CDN_ORIGIN}/twitter-image.png" />
  <style>${LIVE_CONSOLE_CSS}
    .field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
    .field label { font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); }
    input[type="email"], input[type="password"], input[type="text"], select {
      width: 100%; padding: 0.6rem 0.75rem; border-radius: 10px;
      border: 1px solid var(--hairline-strong); background: var(--canvas); color: var(--fg);
      font-family: var(--font-sans); font-size: 0.9rem;
    }
    input:focus, select:focus { outline: 2px solid var(--brand); outline-offset: 1px; }
    .dropzone {
      border: 1.5px dashed rgba(167, 139, 250, 0.45); border-radius: var(--radius);
      background: rgba(167, 139, 250, 0.04); padding: 2rem 1.25rem; text-align: center;
      cursor: pointer; transition: background 150ms, border-color 150ms;
    }
    .dropzone.over { background: rgba(167, 139, 250, 0.14); border-color: var(--brand); }
    .asset-card {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 0.85rem; border: 1px solid var(--hairline); border-radius: 10px; background: var(--surface-2);
    }
    .asset-thumb {
      width: 48px; height: 48px; border-radius: 8px; object-fit: cover;
      background: var(--canvas); border: 1px solid var(--hairline); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 0.68rem; color: var(--faint);
    }
    .asset-meta { min-width: 0; flex: 1; }
    .asset-name { font-weight: 500; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .asset-sub { font-family: var(--font-mono); font-size: 0.74rem; color: var(--faint); }
    .toast {
      position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 50;
      padding: 0.65rem 1rem; border-radius: 10px; border: 1px solid var(--hairline-strong);
      background: var(--surface-3); color: var(--fg); font-size: 0.85rem; display: none;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .hidden { display: none !important; }
  </style>
</head>
<body class="light-glows">
  ${LIGHT_RAYS_HTML}
  <div class="shell">
    <nav class="constellation" aria-label="Upload Studio navigation">
      <div class="row">
        <a href="/" class="label-mono" style="color:var(--brand-ink)">← cdn.mikeodnis.dev</a>
        <span class="label-mono">· Upload Studio PWA</span>
      </div>
      <div class="row">
        <button id="install-btn" type="button" class="btn btn-sm btn-brand hidden">Install App</button>
        <button id="logout-btn" type="button" class="btn btn-sm hidden">Sign out</button>
      </div>
    </nav>

    <main class="grid">
      <section id="auth-card" class="tile">
        <span class="label-mono">Authenticate · ${API_ORIGIN}</span>
        <h1 style="font-size:1.5rem">Sign in to Upload Studio</h1>
        <p>Sign in with your <code>api.mikeodnis.dev</code> account (or paste a Bearer JWT) to upload, sign, and manage R2 assets from any device.</p>
        <form id="login-form" class="grid grid-2" style="max-width:640px">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" required autocomplete="username" placeholder="you@mikeodnis.dev" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" required autocomplete="current-password" placeholder="••••••••••" />
          </div>
          <div class="row" style="grid-column:1/-1">
            <button type="submit" class="btn btn-brand">Sign in</button>
          </div>
        </form>
        <details style="margin-top:1rem">
          <summary style="cursor:pointer;font-size:0.84rem;color:var(--muted)">Or paste an existing Bearer JWT</summary>
          <div class="row" style="margin-top:0.6rem;max-width:640px">
            <input id="manual-token" type="password" placeholder="eyJhbGciOiJIUzI1NiIs..." style="flex:1" />
            <button id="manual-token-btn" type="button" class="btn btn-sm">Use token</button>
          </div>
        </details>
      </section>

      <section id="studio-card" class="grid hidden">
        <div class="tile">
          <div class="hero" style="margin-bottom:0.75rem">
            <div>
              <span class="label-mono" id="user-badge">Signed in</span>
              <h1 style="font-size:1.5rem;margin-bottom:0.2rem">Upload anywhere to R2</h1>
              <p style="margin:0">Drop files, tap to browse, paste screenshots (<kbd>Ctrl+V</kbd>), or share directly from Android.</p>
            </div>
            <div class="row">
              <label class="label-mono" for="visibility">Visibility</label>
              <select id="visibility" style="width:auto">
                <option value="public" selected>Public (/assets/)</option>
                <option value="private">Private (/private/ + HMAC)</option>
              </select>
            </div>
          </div>

          <div id="dropzone" class="dropzone" tabindex="0" role="button" aria-label="Drop files or click to select">
            <div style="font-weight:600;margin-bottom:0.25rem">Drop files here, paste from clipboard, or tap to choose</div>
            <div class="stat-sub">Supports images, videos, PDFs, archives up to 100 MiB · direct upload to R2</div>
            <div class="actions" style="justify-content:center">
              <button id="pick-btn" type="button" class="btn btn-brand">Choose files</button>
              <button id="camera-btn" type="button" class="btn">Camera / Photo</button>
            </div>
            <input id="file-input" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.json,.md,.zip,.woff2" class="hidden" />
            <input id="camera-input" type="file" accept="image/*,video/*" capture="environment" class="hidden" />
          </div>

          <div id="queue" class="grid" style="margin-top:1rem"></div>
        </div>

        <div class="tile">
          <div class="hero" style="margin-bottom:0.75rem">
            <div>
              <span class="label-mono">Cloudflare R2 · ${API_ORIGIN}/v1/media/assets</span>
              <h2 style="margin:0.2rem 0 0">Recent Assets</h2>
            </div>
            <div class="row">
              <input id="search" type="text" placeholder="Filter by filename or key…" style="width:220px" />
              <button id="refresh-btn" type="button" class="btn btn-sm">Refresh</button>
            </div>
          </div>
          <div id="asset-list" class="grid"></div>
        </div>
      </section>
    </main>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <script>
    const API = '${API_ORIGIN}';
    const CDN = '${CDN_ORIGIN}';
    const STORAGE_KEY = 'mike_cdn_session_v1';

    let session = null;
    let assets = [];
    let deferredPrompt = null;

    const $ = (id) => document.getElementById(id);
    const toast = (msg) => {
      const el = $('toast');
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { el.style.display = 'none'; }, 3200);
    };

    const loadSession = () => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
    };
    let sessionEpoch = 0;
    const saveSession = (next) => {
      sessionEpoch += 1;
      session = next;
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
      renderAuthState();
    };

    let refreshPromise = null;

    async function refreshAccessToken() {
      if (!session?.refresh_token) return false;
      if (!refreshPromise) {
        const currentRefresh = session.refresh_token;
        const startEpoch = sessionEpoch;
        refreshPromise = fetch(API + '/v1/core/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefresh }),
        })
          .then(async (ref) => {
            if (!ref.ok) {
              if (sessionEpoch === startEpoch) saveSession(null);
              return false;
            }
            const pair = await ref.json();
            // If the user signed out or switched accounts while refresh was in flight,
            // never resurrect the logged-out session — revoke the newly rotated token instead.
            if (sessionEpoch !== startEpoch || !session) {
              if (pair?.refresh_token) {
                fetch(API + '/v1/core/auth/logout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh_token: pair.refresh_token }),
                }).catch(() => {});
              }
              return false;
            }
            saveSession({ ...session, access_token: pair.access_token, refresh_token: pair.refresh_token });
            return true;
          })
          .catch(() => false)
          .finally(() => {
            refreshPromise = null;
          });
      }
      return refreshPromise;
    }

    async function apiFetch(path, opts = {}, retry = true) {
      const headers = new Headers(opts.headers || {});
      if (session?.access_token) headers.set('Authorization', 'Bearer ' + session.access_token);
      const res = await fetch(API + path, { ...opts, headers });
      if (res.status === 401 && retry && session?.refresh_token) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return apiFetch(path, opts, false);
      }
      return res;
    }

    function renderAuthState() {
      const authed = Boolean(session?.access_token);
      $('auth-card').classList.toggle('hidden', authed);
      $('studio-card').classList.toggle('hidden', !authed);
      $('logout-btn').classList.toggle('hidden', !authed);
      if (authed) {
        $('user-badge').textContent = 'Signed in · ' + (session.user?.email || 'JWT session');
        loadAssets();
        consumeSharedFile();
      }
    }

    async function copyText(text, label) {
      try {
        await navigator.clipboard.writeText(text);
        toast('Copied ' + label);
      } catch {
        prompt('Copy ' + label + ':', text);
      }
    }

    const fmtBytes = (n) => {
      if (!n) return '0 B';
      const u = ['B', 'KB', 'MB', 'GB'];
      const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
      return (n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
    };

    const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
    const EXT_BY_SIG = {
      png: ['png'], jpeg: ['jpg', 'jpeg'], gif: ['gif'], webp: ['webp'], avif: ['avif'],
      ico: ['ico'], pdf: ['pdf'], mp4: ['mp4'], webm: ['webm'], mp3: ['mp3'],
      wav: ['wav'], ogg: ['ogg'], zip: ['zip'], woff2: ['woff2'], svg: ['svg'],
      text: ['txt', 'csv', 'json', 'md'],
    };
    const BIDI_OR_CTRL_RE = /[\\u0000-\\u001F\\u007F\\u061C\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]/;
    const SVG_OPEN_RE = /^\\s*(?:<\\?xml[^>]*\\?>\\s*)?(?:<!DOCTYPE\\s+svg[^>]*>\\s*)?(?:<!--[\\s\\S]*?-->\\s*)*<svg\\b/i;
    const SVG_ACTIVE_RE = /<\\s*(?:script|foreignobject|iframe|object|embed|applet|meta|animate|animatemotion|animatetransform|set|handler)\\b|<!\\s*entity\\b|<!\\s*doctype\\s+[^>]+\\[|\\bon[a-z]{2,32}\\s*=|(?:javascript|vbscript)\\s*:|data\\s*:\\s*(?:text\\/html|image\\/svg\\+xml)|<\\s*use\\b[^>]*\\b(?:xlink:)?href\\s*=\\s*["']?\\s*(?:https?:|\\/\\/|data:)|@import\\b|expression\\s*\\(/i;
    const HTML_PREFIX_RE = /^\\s*(?:<!doctype\\s+html|<html\\b|<script\\b|<iframe\\b|<\\?php\\b)/i;
    const MP4_BRANDS = new Set(['isom','iso2','iso4','iso5','iso6','mp41','mp42','mmp4','avc1','dash','M4V ','M4A ','M4P ','M4B ','qt  ','3gp4','3gp5','3g2a','MSNV']);
    function decodeEntities(s) {
      return s
        .replace(/&#x([0-9a-f]+);/gi, (m, h) => {
          const cp = parseInt(h, 16);
          return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
        })
        .replace(/&#([0-9]+);/g, (m, d) => {
          const cp = parseInt(d, 10);
          return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
        });
    }

    function eqBytes(buf, off, seq) {
      if (buf.length < off + seq.length) return false;
      for (let i = 0; i < seq.length; i++) if (buf[off + i] !== seq[i]) return false;
      return true;
    }

    function decodeUtf8Head(u8, wasTruncated) {
      const dec = new TextDecoder('utf-8', { fatal: true });
      const maxTrim = wasTruncated ? Math.min(3, u8.length) : 0;
      for (let trim = 0; trim <= maxTrim; trim++) {
        try {
          return dec.decode(u8.subarray(0, u8.length - trim));
        } catch {
          // Retry without trailing split multi-byte UTF-8 rune
        }
      }
      return null;
    }

    function detectHeadType(u8, wasTruncated) {
      if (eqBytes(u8, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
      if (eqBytes(u8, 0, [0xff, 0xd8, 0xff])) return 'jpeg';
      if (eqBytes(u8, 0, [0x47, 0x49, 0x46, 0x38])) return 'gif';
      if (eqBytes(u8, 0, [0x52, 0x49, 0x46, 0x46]) && eqBytes(u8, 8, [0x57, 0x45, 0x42, 0x50])) return 'webp';
      if (eqBytes(u8, 0, [0x52, 0x49, 0x46, 0x46]) && eqBytes(u8, 8, [0x57, 0x41, 0x56, 0x45])) return 'wav';
      if (eqBytes(u8, 0, [0x00, 0x00, 0x01, 0x00])) return 'ico';
      if (eqBytes(u8, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
      if (eqBytes(u8, 0, [0x77, 0x4f, 0x46, 0x32])) return 'woff2';
      if (eqBytes(u8, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';
      if (eqBytes(u8, 0, [0x4f, 0x67, 0x67, 0x53])) return 'ogg';
      if (eqBytes(u8, 0, [0x49, 0x44, 0x33]) || (u8.length >= 2 && u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0 && (u8[1] & 0x06) !== 0)) return 'mp3';
      if (eqBytes(u8, 0, [0x50, 0x4b, 0x03, 0x04]) || eqBytes(u8, 0, [0x50, 0x4b, 0x05, 0x06])) return 'zip';
      if (eqBytes(u8, 4, [0x66, 0x74, 0x79, 0x70]) && u8.length >= 12) {
        const b = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
        if (['avif', 'avis', 'mif1', 'msf1'].includes(b)) return 'avif';
        if (MP4_BRANDS.has(b)) return 'mp4';
        return null;
      }
      const text = decodeUtf8Head(u8.subarray(0, 512), wasTruncated);
      if (text === null) return null;
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c < 32 && c !== 9 && c !== 10 && c !== 12 && c !== 13) return null;
      }
      if (HTML_PREFIX_RE.test(text)) return null;
      return SVG_OPEN_RE.test(text) ? 'svg' : 'text';
    }

    async function preflightValidateFile(file) {
      if (!file || file.size <= 0) return 'File is empty';
      if (file.size > MAX_UPLOAD_BYTES) return 'File exceeds 100 MiB limit';
      if (!file.name || file.name.length > 255 || BIDI_OR_CTRL_RE.test(file.name)) return 'Filename contains unsafe control or bidi characters';
      const dot = file.name.lastIndexOf('.');
      const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '';
      if (!ext) return 'Filename must include an allowed extension';
      const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
      const sig = detectHeadType(head, file.size > 512);
      if (!sig) return 'Unrecognized or disallowed file signature';
      if (!(EXT_BY_SIG[sig] || []).includes(ext)) return 'File bytes (' + sig + ') do not match .' + ext + ' extension';
      if (sig === 'svg') {
        if (file.size > 2 * 1024 * 1024) return 'SVG exceeds 2 MiB safety cap';
        const fullSvg = await file.text();
        if (SVG_ACTIVE_RE.test(fullSvg) || SVG_ACTIVE_RE.test(decodeEntities(fullSvg))) {
          return 'SVG contains disallowed active content (script / event handler / animation / external use)';
        }
      }
      return null;
    }

    async function uploadFile(file) {
      const row = document.createElement('div');
      row.className = 'asset-card';
      row.innerHTML = '<div class="asset-meta"><div class="asset-name"></div><div class="asset-sub">Validating signature…</div></div>';
      row.querySelector('.asset-name').textContent = file.name + ' (' + fmtBytes(file.size) + ')';
      $('queue').prepend(row);

      try {
        const validationErr = await preflightValidateFile(file);
        if (validationErr) {
          row.querySelector('.asset-sub').textContent = 'Blocked (client pre-flight): ' + validationErr;
          row.querySelector('.asset-sub').style.color = 'var(--down)';
          toast('Blocked: ' + validationErr);
          return;
        }
        row.querySelector('.asset-sub').textContent = 'Uploading…';

        const form = new FormData();
        form.append('file', file, file.name);
        form.append('visibility', $('visibility').value);

        const res = await apiFetch('/v1/media/upload', { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        row.querySelector('.asset-sub').textContent = 'Uploaded → ' + data.url;
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-sm btn-brand';
        copyBtn.textContent = 'Copy URL';
        copyBtn.onclick = () => copyText(data.url, 'URL');
        row.appendChild(copyBtn);
        toast('Uploaded ' + file.name);
        loadAssets();
      } catch (err) {
        row.querySelector('.asset-sub').textContent = 'Failed: ' + (err.message || err);
        row.querySelector('.asset-sub').style.color = 'var(--down)';
      }
    }

    function handleFiles(fileList) {
      if (!fileList || !fileList.length) return;
      for (const f of fileList) uploadFile(f);
    }

    function renderAssets() {
      const q = ($('search').value || '').trim().toLowerCase();
      const filtered = assets.filter((a) => !q || (a.filename || '').toLowerCase().includes(q) || (a.key || '').toLowerCase().includes(q));
      const root = $('asset-list');
      root.innerHTML = '';
      if (!filtered.length) {
        root.innerHTML = '<p style="margin:0">No assets found.</p>';
        return;
      }
      for (const a of filtered) {
        const card = document.createElement('div');
        card.className = 'asset-card';
        const isImg = (a.mime_type || '').startsWith('image/');
        const isRasterImg = isImg && a.mime_type !== 'image/svg+xml' && !a.mime_type.includes('icon');
        const thumb = isRasterImg && a.visibility === 'public'
          ? Object.assign(document.createElement('img'), { className: 'asset-thumb', src: CDN + '/img/' + a.key + '?w=96&q=75&f=webp', alt: a.filename, loading: 'lazy' })
          : Object.assign(document.createElement('div'), { className: 'asset-thumb', textContent: (a.mime_type || 'file').split('/').pop().slice(0, 5).toUpperCase() });
        const meta = document.createElement('div');
        meta.className = 'asset-meta';
        const name = document.createElement('div');
        name.className = 'asset-name';
        name.textContent = a.filename || a.key;
        const sub = document.createElement('div');
        sub.className = 'asset-sub';
        sub.textContent = [a.visibility, fmtBytes(a.size), a.mime_type].filter(Boolean).join(' · ');
        meta.append(name, sub);

        const btns = document.createElement('div');
        btns.className = 'row';

        const mkBtn = (label, cls, fn) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-sm ' + cls;
          b.textContent = label;
          b.onclick = fn;
          return b;
        };

        btns.append(mkBtn('Copy URL', 'btn-brand', () => copyText(a.url, 'URL')));
        if (isRasterImg && a.visibility === 'public') {
          btns.append(mkBtn('WebP 800w', '', () => copyText(CDN + '/img/' + a.key + '?w=800&q=85&f=webp', 'resized URL')));
        }
        if (isImg && a.visibility === 'public') {
          btns.append(mkBtn('Markdown', '', () => copyText('![' + (a.filename || 'image') + '](' + a.url + ')', 'Markdown')));
        }
        if (a.visibility === 'private') {
          btns.append(mkBtn('Sign 1h', '', async () => {
            const res = await apiFetch('/v1/media/sign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ asset_id: a.id, expires_in: 3600 }),
            });
            if (res.ok) {
              const s = await res.json();
              copyText(s.url, 'signed URL');
            } else toast('Sign failed');
          }));
        }
        btns.append(mkBtn('Delete', 'btn-danger', async () => {
          if (!confirm('Delete ' + (a.filename || a.key) + '?')) return;
          const res = await apiFetch('/v1/media/assets/' + encodeURIComponent(a.id), { method: 'DELETE' });
          if (res.ok) { toast('Deleted'); loadAssets(); } else toast('Delete failed');
        }));

        card.append(thumb, meta, btns);
        root.append(card);
      }
    }

    async function loadAssets() {
      const res = await apiFetch('/v1/media/assets?limit=50&offset=0');
      if (!res.ok) return;
      const data = await res.json();
      assets = data.assets || [];
      renderAssets();
    }

    async function consumeSharedFile() {
      if (!new URLSearchParams(location.search).has('shared')) return;
      if (!('caches' in window)) return;
      try {
        const cache = await caches.open('mike-cdn-share-v1');
        const res = await cache.match('/_shared-file');
        if (!res) return;
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('X-Shared-Filename') || 'shared-upload');
        await cache.delete('/_shared-file');
        history.replaceState(null, '', '/upload');
        uploadFile(new File([blob], name, { type: blob.type }));
      } catch {
        // Ignore share handoff failure
      }
    }

    $('login-form').onsubmit = async (e) => {
      e.preventDefault();
      const res = await fetch(API + '/v1/core/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Sign in failed'); return; }
      saveSession(data);
      toast('Signed in');
    };

    $('manual-token-btn').onclick = () => {
      const tok = $('manual-token').value.trim();
      if (!tok) return;
      saveSession({ access_token: tok });
      toast('JWT session active');
    };

    $('logout-btn').onclick = async () => {
      const rt = session?.refresh_token;
      saveSession(null);
      if (rt) {
        fetch(API + '/v1/core/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        }).catch(() => {});
      }
      toast('Signed out');
    };
    $('refresh-btn').onclick = loadAssets;
    $('search').oninput = renderAssets;
    $('pick-btn').onclick = (e) => { e.stopPropagation(); $('file-input').click(); };
    $('camera-btn').onclick = (e) => { e.stopPropagation(); $('camera-input').click(); };
    $('file-input').onchange = (e) => { handleFiles(e.target.files); e.target.value = ''; };
    $('camera-input').onchange = (e) => { handleFiles(e.target.files); e.target.value = ''; };

    const dz = $('dropzone');
    dz.onclick = () => $('file-input').click();
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); handleFiles(e.dataTransfer.files); };

    window.addEventListener('paste', (e) => {
      if (!session?.access_token) return;
      const files = [...(e.clipboardData?.items || [])]
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter(Boolean);
      if (files.length) handleFiles(files);
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      $('install-btn').classList.remove('hidden');
    });
    $('install-btn').onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      $('install-btn').classList.add('hidden');
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    session = loadSession();
    renderAuthState();
  </script>
</body>
</html>`;
}
