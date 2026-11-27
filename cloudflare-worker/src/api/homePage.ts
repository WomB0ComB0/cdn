// cdn.mikeodnis.dev root page on the shared subdomain design (spec v1): the same markup as the
// api.mikeodnis.dev root, translated from mikeodnis.dev the way links.mikeodnis.dev ports it. Only
// content differs between the two roots; the stylesheet and icon sprite are shared verbatim.
import { API_ORIGIN, CDN_ORIGIN } from './discovery.js';
import { ICON_SPRITE_SVG, SUBDOMAIN_CSS } from './subdomainDesign.js';

const SITE_NAME = 'CDN - Mike Odnis';
const REPO_URL = 'https://github.com/WomB0ComB0/cdn';
const DESCRIPTION =
  'Global edge CDN for public immutable R2 assets, HMAC-SHA256 signed private files, on-the-fly AVIF/WebP image transforms, and the installable Upload Studio PWA.';
const SOCIAL_DESCRIPTION =
  'Cloudflare Workers + R2 edge CDN with immutable caching, HMAC private URLs, imgproxy transforms, and Upload Studio PWA.';
const IMAGE_ALT = `${SITE_NAME}. Edge media delivery, R2 assets, AVIF/WebP transforms, HMAC private URLs`;

const EXTERNAL = 'target="_blank" rel="noopener noreferrer"';
const NEW_TAB_SR = '<span class="sr-only"> (opens in a new tab)</span>';

function icon(name: string, extraClass?: string): string {
  const cls = extraClass ? `icon ${extraClass}` : 'icon';
  return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

const EXT_ICON = icon('arrow-up-right', 'icon-ext');

interface NavLink {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  /** The page or site the visitor is on: links to `/` and is marked "here". */
  readonly current?: true;
}

const isExternal = (href: string): boolean => /^https?:\/\//.test(href);

/** The rail's page items, repeated as the phone menu's "This site" group. */
const SITE_LINKS: readonly NavLink[] = [
  { label: 'Home', href: '/', icon: 'home', current: true },
  { label: 'CDN reference', href: '/docs', icon: 'book-open' },
  { label: 'Upload Studio', href: '/upload', icon: 'arrow-up-tray' },
  { label: 'Source on GitHub', href: REPO_URL, icon: 'code-bracket' },
];

/** links.mikeodnis.dev ECOSYSTEM_LINKS (app/constants/app.ts), same order. */
const NETWORK_LINKS: readonly NavLink[] = [
  { label: 'Portfolio', href: 'https://mikeodnis.dev', icon: 'home' },
  { label: 'Links', href: 'https://links.mikeodnis.dev', icon: 'link' },
  { label: 'Blog', href: 'https://blog.mikeodnis.dev', icon: 'document-text' },
  { label: 'News', href: 'https://news.mikeodnis.dev', icon: 'newspaper' },
  { label: 'API', href: API_ORIGIN, icon: 'cpu-chip' },
  { label: 'CDN', href: '/', icon: 'cloud', current: true },
  { label: 'Status', href: 'https://status.mikeodnis.dev', icon: 'signal' },
  { label: 'Sponsor', href: 'https://mikeodnis.dev/sponsor', icon: 'heart' },
];

const VENTURE_LINKS: readonly NavLink[] = [
  { label: 'Elysium Tools', href: 'https://elysium.tools', icon: 'code-bracket' },
  { label: 'Atroviola', href: 'https://atroviola.com', icon: 'briefcase' },
];

const FOOTER_LINKS: ReadonlyArray<readonly [label: string, href: string]> = [
  ['Portfolio', 'https://mikeodnis.dev'],
  ['Links', 'https://links.mikeodnis.dev'],
  ['Blog', 'https://blog.mikeodnis.dev'],
  ['News', 'https://news.mikeodnis.dev'],
  ['API', API_ORIGIN],
  ['OSS', 'https://elysium.tools'],
];

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'cdn.mikeodnis.dev',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web, Android, iOS, Linux, macOS, Windows',
      url: CDN_ORIGIN,
      description:
        'Global edge media delivery, on-the-fly AVIF/WebP image transformation, and HMAC-SHA256 signed private asset serving backed by Cloudflare Workers and R2.',
      author: { '@type': 'Person', name: 'Mike Odnis', url: 'https://mikeodnis.dev' },
      softwareVersion: '2.0.0',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How are public and private assets served on cdn.mikeodnis.dev?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Public objects under /assets/{key} are served from Cloudflare R2 with 1-year immutable canonical edge caching, ETag validation, and HTTP byte-range support. Private objects under /private/{key} require a constant-time verified HMAC-SHA256 signature (exp and sig) and emit CDN-Cache-Control: no-store, Referrer-Policy: no-referrer, and X-Robots-Tag: noindex, nofollow. Unconfirmed staging/* objects are quarantined (404).',
          },
        },
        {
          '@type': 'Question',
          name: 'How do on-the-fly image transforms work?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Prefix any public raster asset path with /img and pass w (0-4096), h (0-4096), q (10-100), and f (webp, avif, jpg, jpeg, png; default webp). Non-assets/* paths return 403 and non-raster files such as SVG/PDF/ZIP return 415.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I upload files to cdn.mikeodnis.dev from mobile or desktop?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Open https://cdn.mikeodnis.dev/upload (installable PWA with client-side magic-byte and SVG XSS pre-flight validation plus Android Web Share Target support) or POST multipart/form-data with a Bearer JWT to https://api.mikeodnis.dev/v1/media/upload.',
          },
        },
      ],
    },
  ],
});

function renderHead(): string {
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${SITE_NAME}</title>
  <meta name="description" content="${DESCRIPTION}" />
  <meta name="theme-color" content="#0c0c14" />
  <link rel="canonical" href="${CDN_ORIGIN}/" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="describedby" type="text/markdown" href="/llms.txt" title="LLM documentation index" />
  <link rel="service-desc" type="application/yaml" href="/openapi.yaml" title="OpenAPI 3.1 Specification" />
  <link rel="preload" href="/_brand/fonts/geist-v1.9-latin.woff2" as="font" type="font/woff2" crossorigin />
  <style>${SUBDOMAIN_CSS}</style>
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content="${CDN_ORIGIN}/" />
  <meta property="og:title" content="${SITE_NAME}" />
  <meta property="og:description" content="${SOCIAL_DESCRIPTION}" />
  <meta property="og:image" content="${CDN_ORIGIN}/opengraph-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${IMAGE_ALT}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${SITE_NAME}" />
  <meta name="twitter:description" content="${SOCIAL_DESCRIPTION}" />
  <meta name="twitter:image" content="${CDN_ORIGIN}/twitter-image.png" />
  <meta name="twitter:image:alt" content="${IMAGE_ALT}" />
  <meta name="twitter:creator" content="@mike_odnis" />
  <script type="application/ld+json">${JSON_LD}</script>
</head>`;
}

function railItem(link: NavLink): string {
  const tip = `<span class="rail-tip" aria-hidden="true">${link.label}</span>`;
  if (isExternal(link.href)) {
    return `<a class="rail-item" href="${link.href}" aria-label="${link.label} (opens in a new tab)" ${EXTERNAL}>${icon(link.icon)}${tip}</a>`;
  }
  const current = link.current ? ' aria-current="page"' : '';
  return `<a class="rail-item" href="${link.href}" aria-label="${link.label}"${current}>${icon(link.icon)}${tip}</a>`;
}

/** Desktop icon rail: the three page items, the network flyout button, then the source link. */
function renderRail(): string {
  const pages = SITE_LINKS.filter((l) => !isExternal(l.href)).map(railItem);
  const source = SITE_LINKS.filter((l) => isExternal(l.href)).map(railItem);
  return `<header class="rail">
    <nav class="rail-nav" aria-label="Main navigation">
      ${pages.join('\n      ')}
      <button class="rail-item" type="button" popovertarget="site-menu" aria-label="Network: *.mikeodnis.dev">${icon('globe-alt')}<span class="rail-tip" aria-hidden="true">*.mikeodnis.dev</span></button>
      <div class="rail-sep" aria-hidden="true"></div>
      ${source.join('\n      ')}
    </nav>
  </header>`;
}

function renderPageHeader(): string {
  return `<header class="page-header">
        <div class="page-heading">
          <p class="page-eyebrow">cdn.mikeodnis.dev</p>
          <h1 class="page-title">CDN</h1>
          <p class="page-lede">Immutable static asset delivery, on-the-fly AVIF/WebP image transforms via <code>imgproxy</code>, and constant-time HMAC-SHA256 signed private objects for the <code>*.mikeodnis.dev</code> platform.</p>
          <p class="page-stack">Edge asset delivery&nbsp;· Cloudflare Workers + R2</p>
          <div class="actions">
            <a class="btn btn-primary" href="/upload">Open Upload Studio (PWA)</a>
            <a class="btn" href="/docs">OpenAPI docs (Scalar)</a>
            <a class="btn" href="${API_ORIGIN}/docs" ${EXTERNAL}>Media API docs${EXT_ICON}${NEW_TAB_SR}</a>
            <a class="btn" href="/llms.txt">llms.txt</a>
            <a class="btn" href="/openapi.yaml">openapi.yaml</a>
          </div>
        </div>
        <div class="page-aside">
          <p class="status" role="status" data-status data-tone="idle">
            <span class="status-dot" aria-hidden="true"></span>
            <span class="status-word">Checking status…</span>
            <span class="status-detail"></span>
          </p>
        </div>
      </header>`;
}

const CARDS: ReadonlyArray<readonly [label: string, figure: string, meta: string]> = [
  [
    'Public assets',
    '300',
    '<code>/assets/*</code>&nbsp;· 1yr canonical immutable cache&nbsp;· ETag + Range',
  ],
  [
    'Private signed',
    '120',
    '<code>/private/*</code>&nbsp;· HMAC-SHA256&nbsp;· <code>no-store</code> CDN&nbsp;· <code>no-referrer</code>',
  ],
  [
    'Image transforms',
    '60',
    '<code>/img/assets/*</code>&nbsp;· Raster-only (<code>415</code> SVG)&nbsp;· AVIF/WebP',
  ],
];

function renderCards(): string {
  const cards = CARDS.map(
    ([label, figure, meta]) => `<li class="tile card">
              <p class="card-label">${label}</p>
              <p class="card-value"><span class="card-figure">${figure}</span><span class="card-unit">req / 60s</span></p>
              <p class="card-meta">${meta}</p>
            </li>`
  );
  return `<section class="section" aria-labelledby="cards-heading">
        <div class="section-head">
          <h2 id="cards-heading" class="section-label">Edge capabilities</h2>
        </div>
        <ul class="card-row">
            ${cards.join('\n            ')}
        </ul>
      </section>`;
}

const ROUTES: ReadonlyArray<readonly [path: string, auth: string, behavior: string]> = [
  [
    '<code>/assets/{key}</code>',
    'Public',
    'Serves R2 object with query-stripped canonical Edge Cache, <code>max-age=31536000, immutable</code>, <code>ETag</code>/<code>304</code>, <code>206 Range</code>, SVG CSP sandbox, and <code>attachment</code> on active/opaque types.',
  ],
  [
    '<code>/private/{key}?exp=&amp;sig=</code>',
    'HMAC-SHA256',
    'Constant-time signature validation against <code>/private/{key}:{exp}</code> with <code>CDN-Cache-Control: no-store</code>, <code>Referrer-Policy: no-referrer</code>, and <code>noindex</code>. Returns <code>403</code> if expired/invalid.',
  ],
  [
    '<code>/img/assets/{key}?w=&amp;h=&amp;q=&amp;f=</code>',
    'Public',
    'On-the-fly raster resize &amp; WebP/AVIF conversion via imgproxy (default <code>webp</code>). Blocks non-<code>assets/*</code> (<code>403</code>) and non-raster types like SVG/PDF (<code>415</code>).',
  ],
  [
    '<code>/upload</code>',
    'JWT in UI',
    'Installable PWA Upload Studio (pre-flight magic-byte/SVG checks, drag/drop, paste, camera, Android Share Target) wired to <code>api.mikeodnis.dev/v1/media</code>.',
  ],
  [
    '<code>/health</code> &amp; <code>/health/metrics</code>',
    'Public',
    'Liveness check and native Cloudflare edge rate-limiter counters (<code>Cache-Control: no-store</code>, <code>nosniff</code>).',
  ],
];

function renderRouteTable(): string {
  const rows = ROUTES.map(
    ([path, auth, behavior]) =>
      `<tr><td><span class="badge">GET</span></td><td class="cell-code">${path}</td><td class="cell-nowrap" data-label="Auth">${auth}</td><td class="cell-desc" data-label="Behavior &amp; cache">${behavior}</td></tr>`
  );
  return `<section class="section" aria-labelledby="table-heading">
        <div class="section-head">
          <h2 id="table-heading" class="section-label">Edge route reference</h2>
          <p class="section-meta">${ROUTES.length} routes</p>
        </div>
        <div class="tile tile-flush">
          <div class="table-wrap">
            <table class="ref-table">
              <thead>
                <tr><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Auth</th><th scope="col">Behavior &amp; cache</th></tr>
              </thead>
              <tbody>
                ${rows.join('\n                ')}
              </tbody>
            </table>
          </div>
        </div>
      </section>`;
}

const DISCOVERY: ReadonlyArray<readonly [paths: string, description: string]> = [
  ['<a href="/llms.txt"><code>/llms.txt</code></a>', 'Concise Markdown index for LLMs'],
  ['<a href="/llms-full.txt"><code>/llms-full.txt</code></a>', 'Full route, signing &amp; error spec'],
  ['<a href="/openapi.yaml"><code>/openapi.yaml</code></a>', 'OpenAPI 3.1 contract'],
  [
    '<a href="/.well-known/security.txt"><code>/.well-known/security.txt</code></a>',
    'RFC 9116 security contact',
  ],
  [
    '<a href="/robots.txt"><code>/robots.txt</code></a> &amp; <a href="/sitemap.xml"><code>/sitemap.xml</code></a>',
    'Crawler &amp; sitemap directives',
  ],
  [
    '<a href="/manifest.webmanifest"><code>/manifest.webmanifest</code></a>',
    'Installable PWA + Android Share Target',
  ],
];

function renderSplit(): string {
  const discovery = DISCOVERY.map(
    ([paths, description]) => `<li>
                <span class="discovery-paths">${paths}</span>
                <span class="discovery-desc">${description}</span>
              </li>`
  );
  return `<div class="split">
        <section class="section" aria-labelledby="start-heading">
          <div class="section-head">
            <h2 id="start-heading" class="section-label">Quick start examples</h2>
          </div>
          <div class="tile">
            <div class="steps">
              <div class="step">
                <p class="step-label">Fetch an immutable asset or request a resized WebP image:</p>
                <pre class="code" tabindex="0"><code>curl -I ${CDN_ORIGIN}/assets/demo/avatar.png

curl -I "${CDN_ORIGIN}/img/assets/demo/avatar.png?w=640&amp;q=85&amp;f=webp"</code></pre>
              </div>
              <div class="step">
                <p class="step-label">Upload a file via the authenticated Media API:</p>
                <pre class="code" tabindex="0"><code>curl -X POST ${API_ORIGIN}/v1/media/upload \\
  -H "Authorization: Bearer $JWT" \\
  -F "file=@./screenshot.png" \\
  -F "visibility=public"</code></pre>
              </div>
            </div>
          </div>
        </section>

        <section class="section" aria-labelledby="discovery-heading">
          <div class="section-head">
            <h2 id="discovery-heading" class="section-label">Machine &amp; LLM discovery</h2>
          </div>
          <div class="tile">
            <p class="tile-intro">Structured metadata for AI agents, crawlers, and security researchers:</p>
            <ul class="discovery">
              ${discovery.join('\n              ')}
            </ul>
          </div>
        </section>
      </div>`;
}

const FAQ: ReadonlyArray<readonly [question: string, answer: string]> = [
  [
    'How are uploads, SVGs, and active files protected against XSS?',
    "Uploads are verified with 3-way magic-byte + extension + MIME checks and full-document SVG XSS/XXE scanning (presigned PUTs stay quarantined under non-servable <code>staging/*</code> until confirmed). At the edge, SVG/HTML/XML objects emit <code>Content-Security-Policy: default-src 'none'; sandbox</code>, active/zip/opaque payloads force <code>Content-Disposition: attachment</code>, and every response sets <code>X-Content-Type-Options: nosniff</code>.",
  ],
  [
    'How do I install Upload Studio on Android or Desktop?',
    'Open <a href="/upload">/upload</a> in Chrome, Brave, or Safari and tap <strong>Install app</strong> (or <strong>Add to Home Screen</strong>). On Android, it registers in the system Share Sheet so you can share screenshots and photos directly to R2.',
  ],
  [
    'What rate-limit headers does the CDN return?',
    'Every asset, private, and transform request enforces per-visitor isolated edge quotas and returns standard IETF <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code>, <code>RateLimit-Reset</code>, <code>RateLimit-Policy</code>, and <code>Retry-After</code> on HTTP 429.',
  ],
];

function renderFaq(): string {
  const items = FAQ.map(
    ([question, answer], i) => `<details class="faq-item"${i === 0 ? ' open' : ''}>
            <summary>${question}</summary>
            <div class="faq-body"><p>${answer}</p></div>
          </details>`
  );
  return `<section class="section" aria-labelledby="faq-heading">
        <div class="section-head">
          <h2 id="faq-heading" class="section-label">Frequently asked questions</h2>
        </div>
        <div class="tile tile-flush">
          ${items.join('\n          ')}
        </div>
      </section>`;
}

function footerLink(label: string, href: string): string {
  return `<a class="footer-link" href="${href}" ${EXTERNAL}>${label}${NEW_TAB_SR}</a>`;
}

function renderFooter(): string {
  const nav = FOOTER_LINKS.map(([label, href]) => footerLink(label, href));
  return `<footer class="site-footer">
      <div class="footer-row">
        <div class="footer-start">
          <p class="footer-line">
            ${footerLink('Apache-2.0', `${REPO_URL}/blob/main/LICENSE`)}
            2025-present &#169;
            ${footerLink('Mike Odnis', 'https://github.com/WomB0ComB0')}
          </p>
          ${footerLink('WomB0ComB0/cdn', REPO_URL)}
        </div>
        <div class="footer-end">
          <nav class="footer-nav" aria-label="Ecosystem links">
              ${nav.join('\n              <span class="footer-sep" aria-hidden="true">•</span>\n              ')}
          </nav>
          <span class="footer-sep" aria-hidden="true">•</span>
          <a class="status-pill" href="https://status.mikeodnis.dev" ${EXTERNAL} data-status data-tone="idle" aria-label="Status: checking (opens in a new tab)">
            <span class="status-dot" aria-hidden="true"></span>
            <span>Status</span>
          </a>
        </div>
      </div>
    </footer>`;
}

function menuLink(link: NavLink): string {
  const name = `<span class="menu-link-name">${link.label}</span>`;
  if (link.current) {
    return `<li><a class="menu-link" href="/" aria-current="page">${icon(link.icon)}${name}<span class="menu-here">here</span></a></li>`;
  }
  if (isExternal(link.href)) {
    return `<li><a class="menu-link" href="${link.href}" ${EXTERNAL}>${icon(link.icon)}${name}${EXT_ICON}${NEW_TAB_SR}</a></li>`;
  }
  return `<li><a class="menu-link" href="${link.href}">${icon(link.icon)}${name}</a></li>`;
}

function menuGroup(id: string, label: string, links: readonly NavLink[], extraClass = ''): string {
  return `<div class="menu-group${extraClass}">
        <h3 id="${id}" class="menu-group-label">${label}</h3>
        <ul class="menu-list" aria-labelledby="${id}">
              ${links.map(menuLink).join('\n              ')}
        </ul>
      </div>`;
}

/** Bottom bar (phones) plus the one popover that is the rail flyout and the phone sheet. */
function renderMobileChrome(): string {
  return `<nav class="mobile-bar" aria-label="Mobile navigation">
    <div class="mobile-bar-inner">
      <button class="bar-btn" type="button" popovertarget="site-menu" aria-label="Open navigation menu">${icon('bars-3')}<span>Menu</span></button>
      <a class="bar-btn bar-btn-aux" href="/docs" aria-label="Docs: CDN reference">${icon('book-open')}<span aria-hidden="true">Docs</span></a>
    </div>
  </nav>

  <div id="site-menu" class="menu" popover role="dialog" aria-labelledby="site-menu-title">
    <div class="menu-head">
      <h2 id="site-menu-title" class="menu-title">Site menu</h2>
      <button class="menu-close" type="button" popovertarget="site-menu" popovertargetaction="hide" aria-label="Close menu">${icon('x-mark')}</button>
    </div>
    <nav class="menu-body" aria-label="Site pages">
      ${menuGroup('menu-site', 'This site', SITE_LINKS, ' menu-group-site')}
      ${menuGroup('menu-network', '*.mikeodnis.dev', NETWORK_LINKS)}
      ${menuGroup('menu-ventures', 'Ventures', VENTURE_LINKS)}
    </nav>
  </div>`;
}

/** The page's only script: fills the header readout and the footer Status pill (textContent only). */
const STATUS_PROBE = `<script>
    (() => {
      const targets = document.querySelectorAll('[data-status]');
      const set = (tone, word, detail) => {
        for (const el of targets) {
          el.dataset.tone = tone;
          const w = el.querySelector('.status-word');
          const d = el.querySelector('.status-detail');
          if (w) w.textContent = word;
          if (d) d.textContent = detail;
          if (el.classList.contains('status-pill')) el.setAttribute('aria-label', 'Status: ' + word + ' (opens in a new tab)');
        }
      };
      fetch('/health/metrics', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d) => {
          if (d && d.status === 'healthy') {
            const mode = (d.rateLimiter && d.rateLimiter.mode) || 'edge';
            set('live', 'Live', 'edge healthy · limiter ' + mode);
          } else {
            set('ongoing', 'Degraded', 'edge ' + ((d && d.status) || 'unknown'));
          }
        })
        .catch(() => set('idle', 'Status unavailable', ''));
    })();
  </script>`;

export function renderCdnHomePage(): string {
  return `<!doctype html>
<html lang="en">
${renderHead()}
<body class="light-glows">
  <a class="skip-link" href="#main">Skip to content</a>
  ${ICON_SPRITE_SVG}
  <div class="light-rays" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>

  ${renderRail()}

  <div class="page">
    <main id="main" class="shell" tabindex="-1">
      ${renderPageHeader()}

      ${renderCards()}

      ${renderRouteTable()}

      ${renderSplit()}

      ${renderFaq()}
    </main>

    ${renderFooter()}
  </div>

  <div class="edge-haze" aria-hidden="true"></div>

  ${renderMobileChrome()}

  ${STATUS_PROBE}
</body>
</html>`;
}
