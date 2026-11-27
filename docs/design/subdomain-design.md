# Subdomain root design spec v1 (api.mikeodnis.dev + cdn.mikeodnis.dev)

One design for both static roots, translated from the core (mikeodnis.dev, portfolio
`src/styles/globals.css` + `src/components/console/*` + `src/components/layout/footer.tsx`) the
way links.mikeodnis.dev already ports it (`app/assets/css/main.css`, `AppRail.vue`,
`MobileNavBar.vue`, `AppFooter.vue`, `PageShell.vue`). Both implementers produce the SAME markup;
only content differs.

## 0. Files, and keeping the two sites identical

This document lives at `docs/design/subdomain-design.md` in both WomB0ComB0/api and
WomB0ComB0/cdn, and the two copies stay identical. The design files are shared byte for byte:

| File | api (WomB0ComB0/api) | cdn (WomB0ComB0/cdn) |
|---|---|---|
| Stylesheet `subdomain.css` (v1) | `services/gateway/static/_brand/subdomain.css`, served at `/_brand/subdomain.css` | `cloudflare-worker/brand/subdomain.css`, inlined in `<style>` through `src/api/subdomainDesign.ts` |
| Icon sprite (16 heroicons outline symbols, MIT) | inline in `services/gateway/static/index.html` | `cloudflare-worker/brand/icon-sprite.svg.html`, through `subdomainDesign.ts` |
| Geist / Geist Mono 1.900 woff2 + `OFL.txt` | `services/gateway/static/_brand/fonts/`, served at `/_brand/fonts/` | `cloudflare-worker/brand/fonts/`, served at `/_brand/fonts/` through `src/api/brandFonts.ts` |

The fonts come from the `geist` npm package 1.9.2 (OFL-1.1, no Reserved Font Name), variable
`wght` 100-900, subset to core's Latin range plus arrows U+2190-2199 (27 KB and 22 KB). The
version is in each file name, so both sites cache them immutably; a new font version needs a new
name.

To change the design: edit `subdomain.css` (or the sprite or fonts) in both repos identically,
then in the cdn repo run `bun run brand` in `cloudflare-worker/` to regenerate
`subdomainDesign.ts` and `brandFonts.ts`, and update the SHA-256 pins in
`cloudflare-worker/src/__tests__/homePage.test.ts`. The stylesheet contains no backticks, `${` or
backslashes, so it drops into the TS template literal as is; the generator refuses one that does.

## 1. Key decisions

1. **Chrome = core/links chrome, in plain HTML.** Desktop (>= 64rem): the fixed 64px icon rail.
   Phone: the fixed bottom bar (Menu pill + one round helper). The old top `*.MIKEODNIS.DEV` bar is
   removed; its 8 links live in the rail's network flyout, the phone sheet and the footer.
   It works without a framework or script: ONE `<div id="site-menu" popover>` (HTML popover API)
   is the rail's network flyout from 64rem and the phone's bottom sheet below it. Light-dismiss,
   Esc and focus return are native. Core's command palette (Ctrl K) is the one thing not ported
   (a static page has nothing to search); its slot in the bar is a "Docs" helper to `/docs`.
2. **Header = links' PageShell**: eyebrow = host, h1 = network name (`API`, `CDN`), lede, a mono
   stack line, actions under the lede, hairline under the header. Not core's hero tile (that is
   the portfolio home only).
3. **Status in ONE place**: a borderless live readout (dot + status word + mono detail) at the end
   of the page header, level with the actions on desktop and under them on a phone (links'
   "● Live"). The old footer probe text merges into its detail. The footer keeps core's bordered
   **Status pill**, which is the page's only link to status.mikeodnis.dev.
4. **Core values, not look-alikes**: every colour is the core token literal (oklch). Canvas
   resolves to exactly `#0c0c14` (core THEME_COLOR). The old pages' brand `#a78bfa` (Tailwind
   violet) becomes core periwinkle `#8884d5`; old fg `#f4f4f8` becomes `#e8e9ff`, and so on (table
   in section 2).
5. **Fonts actually load**: same-origin woff2 at `/_brand/fonts/`, allowed by the existing CSPs
   (`default-src 'self'` covers `font-src`). No CSP change is needed on either site.
6. **Core's refined type rules**: Geist for everything people read, Geist Mono only for machine
   tokens. Weights 400/500/600. Sentence case everywhere in content: no upper-case mono labels
   except the chrome's menu group labels (core `label-mono`).
7. **Primary action = core's filled periwinkle pill** (44px, `bg brand`, canvas text). Every
   other action is the hairline ghost pill. Exactly one primary per page.
8. **One card, one table, one badge, one code block, one discovery list** for both sites. The
   card row is 1 column, then 2 (an odd last card spans both), then all in one row from a 60rem
   page, so 3 cards (cdn) and 4 (api) both fill the row.
9. **Phones never scroll sideways**: every grid uses `minmax(0, 1fr)`. The live cdn page
   overflowed at 375px because its implicit grid column sized to a `<pre>`. Code blocks scroll
   inside themselves. The table stacks under a 40rem page, like core's index table.

## 2. Tokens (core value -> CSS variable)

Names are the core's own. Values are literals (no `color-mix()`, no relative colours).

| Variable | Value (core) | sRGB | Old api/cdn value | Used for |
|---|---|---|---|---|
| `--canvas` | `oklch(16% 0.016 285deg)` | `#0c0c14` | `#0c0c14` | page, code wells |
| `--surface-1` | `oklch(20% 0.02 285deg)` | `#15151f` | `rgba(17,17,28,.86)` | tiles, cards |
| `--surface-2` | `oklch(23.5% 0.025 285deg)` | `#1d1c2a` | `#161625` | row/summary hover, flyout, bar pills |
| `--surface-3` | `oklch(27% 0.028 285deg)` | `#252534` | `#1e1e32` | ghost button hover, rail current, menu hover |
| `--hairline` | `oklch(30% 0.03 285deg)` | `#2c2c3c` | `rgba(255,255,255,.08)` | every border (default border colour) |
| `--hairline-strong` | `oklch(40% 0.04 285deg)` | `#45455d` | `rgba(255,255,255,.16)` | table header rule, hover borders |
| `--fg` | `oklch(94% 0.03 285deg)` | `#e8e9ff` | `#f4f4f8` | titles, cells, tokens in muted copy |
| `--fg-muted` | `oklch(74% 0.038 285deg)` | `#a8a8c3` | `#a1a1b5` (`--muted`) | lede, labels, meta, footer row |
| `--fg-faint` | `oklch(65% 0.03 285deg)` | `#8d8da1` | `#71718a` (`--faint`) | stack line, `th`, section meta, menu group labels |
| `--brand` | `oklch(65% 0.12 285deg)` | `#8884d5` | `#a78bfa` | primary pill, rail tick, accent-color |
| `--brand-ink` | `oklch(76% 0.1 285deg)` | `#aaa8ee` | `#c4b5fd` | links, footer links, badge text, focus ring |
| `--brand-subtle` | `oklch(30% 0.07 285deg)` | `#2b284f` | `rgba(167,139,250,.14)` | badge fill, current menu item, selection |
| `--live` | `oklch(80% 0.18 152deg)` | `#4bde81` | `#34d399` | status word/dot "Live" |
| `--ongoing` | `oklch(80% 0.123 80deg)` | `#e7b45a` | `--warn #fbbf24` | "Degraded" |
| `--down` | `oklch(72% 0.15 25deg)` | `#f47b74` | `#f87171` | outage tone |
| `--live-halo` | `oklch(80% 0.18 152deg / 20%)` | | | live dot pulse ring |
| `--focus` | `oklch(76% 0.1 285deg)` | `#aaa8ee` | (none) | the one focus ring, 2px, offset 2px |
| `--brand-glow`, `--brand-edge`, `--brand-rim`, `--brand-halo` | brand at 9/18/80/10% | | | reserved (core names) |
| `--light-rays` | `rgb(88 68 188)` | | same | glows (5.4%/4.2%) and rays (14%) |
| `--radius` / `--radius-md` / `--radius-tile` | `0.5rem` / `0.375rem` / `0.75rem` | | `14px`, `10px`, `6px` | code, rail items / badges, menu links, tips / tiles, cards, sheet |
| `--shadow-raised` | `inset 0 1px 0 0 oklch(100% 0 0deg / 5%), 0 8px 24px -8px oklch(0% 0 0deg / 55%)` | | | rail tips, sheet |
| `--font-sans` | `"Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif` | | declared, never loaded | everything |
| `--font-mono` | `"Geist Mono", ui-monospace, sfmono-regular, menlo, monospace` | | declared, never loaded | machine tokens |
| `--text-label` / `--text-meta` / `--text-body-sm` / `--text-body` | `.75` / `.8125` / `.875` / `1rem` | | | type scale |
| `--tracking-label` | `0.08em` | | | menu group labels |
| `--motion-instant/fast/base/slow` | `100/150/240/400ms` | | `140ms` | transitions |
| `--ease-standard` / `--ease-effect` / `--ease-out-expo` | core curves | | | |
| `--container-shell` | `75rem` | | `1080px` | page column |
| `--page-gutter` | `clamp(1rem, 0.5rem + 2vw, 2rem)` | | `1.25rem` | side padding |
| `--rail-w` / `--mobile-bar-h` | `4rem` / `4.5rem` (+ safe area) | | | chrome |

`"Geist Fallback"` is core's own metric-matched Arial (`ascent-override 95.94%`,
`descent-override 28.16%`, `size-adjust 104.76%`), so the swap barely moves text.

Contrast (WCAG 2.x): fg/fg-muted/fg-faint/brand-ink on canvas, a ray-lit
canvas and all three surfaces: lowest is fg-faint on surface-3 at 4.65:1. Primary label 5.82:1,
badge 6.33:1, Live word 10.05:1 under a ray, focus ring at least 6.9:1. All pass.

## 3. Type scale (core utility -> class here)

| Role | Class | Font / size / line / weight / tracking | Core source |
|---|---|---|---|
| Page title (h1) | `.page-title` | Geist 2rem/1.1/600/-0.035em; 2.75rem/1.05/-0.04em from a 48rem page | `page-title` |
| Eyebrow | `.page-eyebrow` | Geist .8125rem/1rem/500, fg-muted | `tile-label` |
| Lede | `.page-lede` | Geist 1rem/1.625rem/400, fg-muted, max 60ch | `text-body` |
| Stack line | `.page-stack` | Geist Mono .75rem/1rem/400, fg-faint | `mono-token` |
| Section label (h2) | `.section-label` | Geist .8125rem/1rem/500, fg-muted, sentence case | sponsor `SECTION_LABEL_CLASS` |
| Section meta | `.section-meta` | Geist .8125rem/1.125rem, fg-faint, tabular | `tile-meta` |
| Card label | `.card-label` | = section label | `tile-label` |
| Card figure + unit | `.card-figure` `.card-unit` | Geist 1.75rem/1/600/-0.02em tabular + .875rem/1.25rem fg-muted | `figure-sm` + `figure-unit` |
| Card route | `.card-route` | Geist Mono 1.125rem/1.75rem/500/-0.01em | mono token at title size |
| Card meta | `.card-meta` | Geist .8125rem/1.125rem, fg-muted | `tile-meta` |
| Button | `.btn` | Geist .875rem/1.25rem/500 | hero pills |
| Table header | `.ref-table th` | Geist .8125rem/1rem/500 fg-faint, sentence case | index-table `th` |
| Table cell | `.ref-table td` | Geist .875rem/1.375rem fg; `.cell-desc` fg-muted | `text-body-sm` |
| Badge | `.badge` | Geist Mono .75rem/1rem/400 on brand-subtle | links slug chip |
| Code block | `.code` | Geist Mono .8125rem/1.25rem | |
| FAQ question / answer | `summary` / `.faq-body` | Geist 1rem/1.5rem/500 / .875rem/1.375rem fg-muted | |
| Footer row | `.footer-row` | Geist Mono .8125rem/1.125rem fg-muted; links brand-ink dotted, offset 4px | core footer |
| Menu group label | `.menu-group-label` | Geist Mono .75rem/1rem, .08em, UPPER CASE, fg-faint | `label-mono` (chrome only) |

Inline `code` is Geist Mono at .9em; inside muted copy it steps up to fg (no box). A link inside
running text (`p`, `li`, `td`, `dd`, without a class) gets a dotted underline, so it never relies
on colour alone.

## 4. Shape, rhythm, depth, motion

- **Radii**: tiles/cards/sheet 12px; code/rail items 8px; badges/menu links/tips 6px; buttons,
  bar pills, Status pill fully round.
- **Rhythm**: page padding 24px block (40px from 48rem) + gutter; header to first section 24px;
  between sections 40px; section label to its content 16px; card gap 16px; tile padding 16px,
  20px from a 40rem page; header bottom padding 16/20px over a hairline.
- **Depth**: flat hairline tiles on surface-1 (no shadow: core `plain` tiles). Raised shadow only
  on rail tips and the menu. Atmosphere: `.light-glows` on body + the five `.light-rays` (core's
  exact rays, values now in the CSS via `:nth-child`, so no inline styles) + `.edge-haze`, core's
  scroll edge haze as one blur layer per band, shown only while the page scrolls
  (`animation-timeline: scroll()`; absent where unsupported).
- **Hover**: ghost pill -> hairline-strong border + surface-3; primary -> brand-ink; table
  row/summary -> surface-2; rail item -> surface-2 + fg; links -> fg. Cards are not links, so
  they never lift (core lifts only interactive tiles).
- **Focus**: `:focus-visible` 2px `--focus` outline, offset 2px (inset 2px on FAQ summaries).
  `html` carries core's and links' `scroll-padding-block` (the edge-haze height top and bottom,
  plus the phone bar's height at the bottom below 64rem; 4.625rem minimum at the top from 64rem),
  so a focused element or `#hash` target never lands under the bar or the haze (WCAG 2.4.11).
- **Motion**: colour/opacity transitions on the motion tokens; the header readout's live dot
  pulses (`live-pulse`, scoped to `.status`; the footer Status pill's dot stays still, as core's
  does); the menu fades/slides in via `@starting-style`; the FAQ chevron rotates.
  `prefers-reduced-motion: reduce` cuts animations to 1ms and transitions to 0s (core's rule), the
  rays stand still at 60% of peak, and the header dot gets a static halo. Reduced transparency makes
  the bars opaque and drops the haze. Forced colours drop glows, rays and haze.

## 5. Page anatomy and exact markup

Both pages follow the skeleton below exactly; it is normative, and `{...}` marks per-site content (section 9).

### 5.1 Document

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{Name} - Mike Odnis</title>
  <meta name="description" content="{description}" />
  <meta name="theme-color" content="#0c0c14" />
  <link rel="canonical" href="{origin}/" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  {site links: manifest (cdn), describedby, service-desc - unchanged}
  <link rel="preload" href="/_brand/fonts/geist-v1.9-latin.woff2" as="font" type="font/woff2" crossorigin />
  <style>{subdomain.css verbatim}</style>   <!-- or <link rel="stylesheet" href="/_brand/subdomain.css" /> -->
  {og:* and twitter:* per section 8}
  {existing application/ld+json block, unchanged}
</head>
<body class="light-glows">
  <a class="skip-link" href="#main">Skip to content</a>
  {icon-sprite.svg.html}
  <div class="light-rays" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  <header class="rail">...</header>                  <!-- 5.2 -->
  <div class="page">
    <main id="main" class="shell" tabindex="-1">
      <header class="page-header">...</header>       <!-- 5.3 -->
      <section class="section" aria-labelledby="cards-heading">...</section>   <!-- 5.5 -->
      <section class="section" aria-labelledby="table-heading">...</section>   <!-- 5.6 -->
      <div class="split">...</div>                   <!-- 5.7 -->
      <section class="section" aria-labelledby="faq-heading">...</section>     <!-- 5.8 -->
    </main>
    <footer class="site-footer">...</footer>         <!-- 5.9 -->
  </div>
  <div class="edge-haze" aria-hidden="true"></div>
  <nav class="mobile-bar" aria-label="Mobile navigation">...</nav>          <!-- 5.2 -->
  <div id="site-menu" class="menu" popover role="dialog" aria-labelledby="site-menu-title">...</div>
  <script>{probe, 5.10}</script>
</body>
</html>
```

Drop `class="dark"` from `<html>` (the CSS is dark-only via `color-scheme`). Do not preload
Geist Mono (core does not either).

### 5.2 Chrome

Rail: three page items, the network button, a separator, then the source link. Icons are
`<svg class="icon" aria-hidden="true"><use href="#i-NAME"/></svg>`. The tip is `aria-hidden`
(the item carries `aria-label`). Same-origin items open in place; the source link opens a new tab.

```html
<header class="rail">
  <nav class="rail-nav" aria-label="Main navigation">
    <a class="rail-item" href="/" aria-label="Home" aria-current="page">{icon home}<span class="rail-tip" aria-hidden="true">Home</span></a>
    <a class="rail-item" href="/docs" aria-label="{API|CDN} reference">{icon book-open}<span class="rail-tip" aria-hidden="true">{API|CDN} reference</span></a>
    <a class="rail-item" href="{third}" aria-label="{label}">{icon}<span class="rail-tip" aria-hidden="true">{label}</span></a>
    <button class="rail-item" type="button" popovertarget="site-menu" aria-label="Network: *.mikeodnis.dev">{icon globe-alt}<span class="rail-tip" aria-hidden="true">*.mikeodnis.dev</span></button>
    <div class="rail-sep" aria-hidden="true"></div>
    <a class="rail-item" href="https://github.com/WomB0ComB0/{repo}" aria-label="Source on GitHub (opens in a new tab)" target="_blank" rel="noopener noreferrer">{icon code-bracket}<span class="rail-tip" aria-hidden="true">Source on GitHub</span></a>
  </nav>
</header>
```

Third item: api `/v1/core/docs` "Core docs" (`cpu-chip`); cdn `/upload` "Upload Studio"
(`arrow-up-tray`). Keep the network button the 4th rail item: the flyout's fallback `top`
(11.25rem) assumes it (anchor positioning is used where supported).

Bottom bar (hidden from 64rem):

```html
<nav class="mobile-bar" aria-label="Mobile navigation">
  <div class="mobile-bar-inner">
    <button class="bar-btn" type="button" popovertarget="site-menu" aria-label="Open navigation menu">{icon bars-3}<span>Menu</span></button>
    <a class="bar-btn bar-btn-aux" href="/docs" aria-label="Docs: {API|CDN} reference">{icon book-open}<span aria-hidden="true">Docs</span></a>
  </div>
</nav>
```

The helper's accessible name starts with its visible word ("Docs: API reference"), so it passes
WCAG 2.5.3 Label in Name; both sites use exactly this form.

Site menu: one popover for both. `.menu-head` and `.menu-group-site` show only below 64rem.
Network rows: the current site has `href="/"`, `aria-current="page"` and
`<span class="menu-here">here</span>`. Every other row is external: `target="_blank"
rel="noopener noreferrer"`, then `{icon arrow-up-right class="icon icon-ext"}` and
`<span class="sr-only"> (opens in a new tab)</span>`.

```html
<div id="site-menu" class="menu" popover role="dialog" aria-labelledby="site-menu-title">
  <div class="menu-head">
    <h2 id="site-menu-title" class="menu-title">Site menu</h2>
    <button class="menu-close" type="button" popovertarget="site-menu" popovertargetaction="hide" aria-label="Close menu">{icon x-mark}</button>
  </div>
  <nav class="menu-body" aria-label="Site pages">
    <div class="menu-group menu-group-site">
      <h3 id="menu-site" class="menu-group-label">This site</h3>
      <ul class="menu-list" aria-labelledby="menu-site">{the rail's 4 links as .menu-link rows}</ul>
    </div>
    <div class="menu-group">
      <h3 id="menu-network" class="menu-group-label">*.mikeodnis.dev</h3>
      <ul class="menu-list" aria-labelledby="menu-network">
        <li><a class="menu-link" href="https://mikeodnis.dev" target="_blank" rel="noopener noreferrer">{icon home}<span class="menu-link-name">Portfolio</span>{ext icon}{sr new tab}</a></li>
        ... Links (link), Blog (document-text), News (newspaper), API (cpu-chip), CDN (cloud), Status (signal), Sponsor (heart)
      </ul>
    </div>
    <div class="menu-group">
      <h3 id="menu-ventures" class="menu-group-label">Ventures</h3>
      <ul class="menu-list" aria-labelledby="menu-ventures">Elysium Tools (code-bracket) https://elysium.tools, Atroviola (briefcase) https://atroviola.com</ul>
    </div>
  </nav>
</div>
```

These are the URLs from link-shortener `app/constants/app.ts` `ECOSYSTEM_LINKS`, in the same order.

`role="dialog"` on `#site-menu` is required: `aria-labelledby` is not allowed on a role-less
`div`, and with the phone sheet open its heading and close button would sit outside any landmark.
It announces as `dialog "Site menu"`.

Desktop flyout geometry matches core and links: left edge 7px past the rail (x = 71px), 6px
padding, label 7px below the top edge (the hidden this-site group leaves no divider), rows 40px
apart (2px list gap; the phone sheet keeps 4px, as links' sheet does), a 4px top pad on a label
under a divider, 475px tall for the 10 links. Row icons use `--fg-faint` only on rows that leave
the site (`target="_blank"`); this site's own pages keep `--fg`, as links does.

### 5.3 Page header and status readout

```html
<header class="page-header">
  <div class="page-heading">
    <p class="page-eyebrow">{host}</p>
    <h1 class="page-title">{API|CDN}</h1>
    <p class="page-lede">{lede}</p>
    <p class="page-stack">{stack, items joined with "&nbsp;· "}</p>
    <div class="actions">
      <a class="btn btn-primary" href="{primary}">{label}</a>
      <a class="btn" href="{same-origin}">{label}</a>
      <a class="btn" href="{other origin}" target="_blank" rel="noopener noreferrer">{label}<svg class="icon icon-ext" aria-hidden="true"><use href="#i-arrow-up-right"/></svg><span class="sr-only"> (opens in a new tab)</span></a>
    </div>
  </div>
  <div class="page-aside">
    <p class="status" role="status" data-status data-tone="idle">
      <span class="status-dot" aria-hidden="true"></span>
      <span class="status-word">Checking status…</span>
      <span class="status-detail"></span>
    </p>
  </div>
</header>
```

`data-tone` is one of `idle | live | ongoing | down`; the probe sets it (5.10). Words come from
core's status copy: "Checking status…" (idle), "Live" (live), "Degraded" (ongoing),
"Status unavailable" (idle, when the probe fails).

### 5.4 Buttons

`.btn` = ghost pill (hairline border, fg). `.btn btn-primary` = filled brand, canvas text. One
primary per page. No trailing "→" glyphs. Only links to another origin get the ↗ icon,
`target="_blank"` and the sr-only "(opens in a new tab)", as core's pills do.

### 5.5 Card row (one component, 3 or 4 cards)

```html
<section class="section" aria-labelledby="cards-heading">
  <div class="section-head"><h2 id="cards-heading" class="section-label">{label}</h2></div>
  <ul class="card-row">
    <li class="tile card">
      <p class="card-label">{label}</p>
      <p class="card-value">{EITHER <code class="card-route">/v1/core</code>
                             OR <span class="card-figure">300</span><span class="card-unit">req / 60s</span>}</p>
      <p class="card-meta">{meta, "&nbsp;· " separators, <code> for tokens}</p>
    </li>
  </ul>
</section>
```

### 5.6 Reference table + badge

```html
<section class="section" aria-labelledby="table-heading">
  <div class="section-head">
    <h2 id="table-heading" class="section-label">{label}</h2>
    <p class="section-meta">{row count, e.g. "6 tiers"}</p>
  </div>
  <div class="tile tile-flush">
    <p class="tile-intro">{optional intro}</p>
    <div class="table-wrap">
      <table class="ref-table">
        <thead><tr><th scope="col">{A}</th><th scope="col">{B}</th><th scope="col">{C}</th><th scope="col">{D}</th></tr></thead>
        <tbody>
          <tr>
            <td>{A}</td>
            <td>{B}</td>
            <td class="cell-nowrap" data-label="{C header}">{C}</td>
            <td class="cell-desc" data-label="{D header}">{D}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
```

Rules: the first two cells have NO `data-label` (they share the first line when stacked under a
40rem page); every later cell carries `data-label` equal to its header text. Method and tier
values are `<span class="badge">GET</span>` (24px tall: links' slug chip, 4px x 8px padding). Path
cells wrap only where a path would overflow (`overflow-wrap: break-word`, not `anywhere`, which
let the auto table layout squeeze the column to one character between 40rem and 75rem). Path cells are
`<td class="cell-code"><code>…</code></td>`.

### 5.7 Quick start + machine discovery (`.split`)

```html
<div class="split">
  <section class="section" aria-labelledby="start-heading">
    <div class="section-head"><h2 id="start-heading" class="section-label">{label}</h2></div>
    <div class="tile">
      <div class="steps">
        <div class="step">
          <p class="step-label">{label}:</p>
          <pre class="code" tabindex="0"><code>{escaped shell}</code></pre>
        </div>
      </div>
    </div>
  </section>
  <section class="section" aria-labelledby="discovery-heading">
    <div class="section-head"><h2 id="discovery-heading" class="section-label">{label}</h2></div>
    <div class="tile">
      <p class="tile-intro">{intro}</p>
      <ul class="discovery">
        <li>
          <span class="discovery-paths"><a href="/llms.txt"><code>/llms.txt</code></a> &amp; <a href="/llms-full.txt"><code>/llms-full.txt</code></a></span>
          <span class="discovery-desc">{description}</span>
        </li>
      </ul>
    </div>
  </section>
</div>
```

Two equal columns from a 56rem page (tiles stretch to equal height), stacked below that.
`tabindex="0"` on `pre.code` makes the scrollable block keyboard-reachable.

### 5.8 FAQ

```html
<section class="section" aria-labelledby="faq-heading">
  <div class="section-head"><h2 id="faq-heading" class="section-label">Frequently asked questions</h2></div>
  <div class="tile tile-flush">
    <details class="faq-item" open>
      <summary>{question}</summary>
      <div class="faq-body"><p>{answer}</p></div>
    </details>
    <details class="faq-item">…</details>
  </div>
</section>
```

The first item is `open`. The chevron is CSS (`summary::after`); add no icon markup. An inline
link in an answer that leaves the site follows the page-wide rule: `target="_blank"
rel="noopener noreferrer"` plus `<span class="sr-only"> (opens in a new tab)</span>`.

### 5.9 Footer (core's)

```html
<footer class="site-footer">
  <div class="footer-row">
    <div class="footer-start">
      <p class="footer-line">
        <a class="footer-link" href="https://github.com/WomB0ComB0/{repo}/blob/{master|main}/LICENSE" target="_blank" rel="noopener noreferrer">Apache-2.0<span class="sr-only"> (opens in a new tab)</span></a>
        2025-present &#169;
        <a class="footer-link" href="https://github.com/WomB0ComB0" target="_blank" rel="noopener noreferrer">Mike Odnis<span class="sr-only"> (opens in a new tab)</span></a>
      </p>
      <a class="footer-link" href="https://github.com/WomB0ComB0/{repo}" target="_blank" rel="noopener noreferrer">WomB0ComB0/{repo}<span class="sr-only"> (opens in a new tab)</span></a>
    </div>
    <div class="footer-end">
      <nav class="footer-nav" aria-label="Ecosystem links">
        <a class="footer-link" href="https://mikeodnis.dev" target="_blank" rel="noopener noreferrer">Portfolio<span class="sr-only"> (opens in a new tab)</span></a>
        <span class="footer-sep" aria-hidden="true">•</span>
        … Links • Blog • News • {CDN on api | API on cdn} • OSS (https://elysium.tools)
      </nav>
      <span class="footer-sep" aria-hidden="true">•</span>
      <a class="status-pill" href="https://status.mikeodnis.dev" target="_blank" rel="noopener noreferrer" data-status data-tone="idle" aria-label="Status: checking (opens in a new tab)">
        <span class="status-dot" aria-hidden="true"></span><span>Status</span>
      </a>
    </div>
  </div>
</footer>
```

2025 is the first-commit year of both repos (api 2025-11-18, cdn 2025-06-05). The year range uses
a hyphen, as links does.

### 5.10 Live probe (the page's only script)

The same IIFE on both sites; only the URL and the success branch differ. It uses `textContent`
only, never `innerHTML`.

```js
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
  const up = (s) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm';
  };
  fetch('{PROBE_URL}', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((d) => { {SUCCESS_BRANCH} })
    .catch(() => set('idle', 'Status unavailable', ''));
})();
```

- api: `PROBE_URL = /v1/core/status`; if `d.status === 'ok'`:
  `set('live', 'Live', 'limiter ' + (d.rate_limiter?.store_mode || 'active') + ' · core v' + (d.version || '1.0.0') + ' · up ' + up(d.uptime_seconds || 0))`,
  else `set('ongoing', 'Degraded', 'core ' + (d.status || 'unknown'))`.
- cdn: `PROBE_URL = /health/metrics`; if `d.status === 'healthy'`:
  `set('live', 'Live', 'edge healthy · limiter ' + (d.rateLimiter?.mode || 'edge'))`,
  else `set('ongoing', 'Degraded', 'edge ' + (d.status || 'unknown'))`.

(`?.` and `&&` chains are both fine here.)

## 6. Cross-subdomain navigation: why rail + footer works statically

Core and links navigate with the rail (desktop), the bottom bar (phone) and footer links. All
three are plain links except two disclosures: the rail's network flyout and the phone menu
sheet. The HTML popover API (`popover` + `popovertarget`, Chrome 114, Safari 17, Firefox 125)
gives both with no script: top layer, light dismiss, Esc, and an automatic `aria-expanded` on the
invoker. CSS places the one popover as a flyout or a sheet by viewport, and
`body:has(#site-menu:popover-open)` styles the open rail button. Where anchor positioning exists,
the flyout follows the button; elsewhere a fixed `top` matches it. So the core pattern ports
fully. Only the command palette is dropped (nothing to search on a one-page root), and the
bar's second slot becomes "Docs". The CSPs need nothing new: no inline handlers, and the one
inline script is the probe, which `'unsafe-inline'` already allows.

## 7. Fonts and serving

Both sites serve the two woff2 files and `OFL.txt` at `/_brand/fonts/` with
`Content-Type: font/woff2` (`text/plain` for OFL.txt), `X-Content-Type-Options: nosniff` and
`Cache-Control: public, max-age=31536000, immutable` on the woff2 files. Immutable caching is safe
because the font version is in the filename; a new font version gets a new name. `OFL.txt` has no
version in its name, so both sites cache it for a day (`public, max-age=86400`), and a missing
font name is a plain 404 that is never cached as immutable. Same-origin font loads need no
CORS headers. `@font-face` uses `font-display: swap` and a `unicode-range` equal to the subset.

- **api (Caddy)**: put the files in `services/gateway/static/_brand/fonts/` (the Dockerfile
  already copies `static` to `/srv/static`). Add a `handle` before the final catch-all, e.g.
  `@brandfont path /_brand/fonts/*.woff2` with `header Content-Type font/woff2`,
  `header Cache-Control "public, max-age=31536000, immutable"`, `root * /srv/static`,
  `file_server`, plus `/_brand/fonts/OFL.txt` as text. If the CSS is served rather than inlined,
  add `/_brand/subdomain.css` (`text/css; charset=utf-8`, `max-age=300` like the page). The
  `@root_html` CSP stays as is.
- **cdn (Worker)**: handle `/_brand/fonts/geist-v1.9-latin.woff2`,
  `/_brand/fonts/geist-mono-v1.9-latin.woff2` and `/_brand/fonts/OFL.txt` in the static block of
  `router.ts`, next to `/favicon.ico` and before rate limiting and `AssetPath.parse`, with
  `staticResponse(method, bytes, 'font/woff2', { cacheControl: 'public, max-age=31536000, immutable' })`.
  Precedent for the bytes: `brandAssets.ts` (base64 + `decodeBase64`), e.g. a generated
  `brandFonts.ts`; a wrangler `rules` Data import also works. Inline the CSS as a string
  constant (`SUBDOMAIN_CSS`) in `renderCdnHomePage()`. `CSP_HTML_HOME` stays as is.

## 8. Title and meta convention

From links (`use-page-seo.ts`, commit 967d487 "replace em-dashes with clean separators") and core
(`pageTitle()`: `'Mike Odnis - %s'`): the separator is a spaced hyphen-minus, never an em dash.

| Page | `<title>` = og:title = twitter:title | og:site_name |
|---|---|---|
| api root | `API - Mike Odnis` | `API - Mike Odnis` |
| cdn root | `CDN - Mike Odnis` | `CDN - Mike Odnis` |
| subpages (optional, same change if trivial) | `{Page} - {Name}`: `Reference - API`, `Reference - CDN`, `Upload Studio - CDN` | `{Name} - Mike Odnis` |

- `og:image:alt` and `twitter:image:alt` = `{title}. {alt text}` (links' form), e.g.
  `API - Mike Odnis. Platform API gateway, Core auth, R2 media uploads, GraphQL, live telemetry`.
- Add `og:locale = en_US` and `twitter:image:alt`; keep `theme-color #0c0c14`, `og:type website`,
  image size and type, `twitter:card summary_large_image` and `twitter:creator @mike_odnis`.
- `description` / `og:description`: keep each site's current text (neither contains an em dash).
- Copy rule for the whole page: no em dashes (`—`). Use a colon, a period or a comma (api lede:
  "ecosystem: unified…"; api FAQ: "Yes. Open…"). Use sentence case for headings, labels and
  buttons; keep proper nouns (Upload Studio, OpenAPI, Scalar). Join middle-dot lists with
  `&nbsp;· ` (core's "Founder · New York"), so a dot never starts a line.

## 9. Per-site content mapping (nothing dropped)

### api.mikeodnis.dev (`services/gateway/static/index.html`)

| Old element | New block |
|---|---|
| `nav.constellation` (8 links, API current) | site menu `*.mikeodnis.dev` group (all 8, API = `here`) via the rail globe and the phone Menu; plus footer nav |
| `.label-mono` "Platform API Gateway · Caddy · Bun · Go · Hasura" | `.page-stack` "Platform API gateway&nbsp;· Caddy&nbsp;· Bun&nbsp;· Go&nbsp;· Hasura" |
| `h1` "api.mikeodnis.dev" | `.page-eyebrow` "api.mikeodnis.dev"; `h1.page-title` "API" |
| lede paragraph | `.page-lede` (em dash -> colon) |
| buttons: Unified API Docs (Core + Media + CDN) →, Core Docs, CDN Upload Studio, llms.txt | `.actions`: primary "Unified API docs (Core + Media + CDN)" `/docs`; ghost "Core docs" `/v1/core/docs`; ghost "CDN Upload Studio" (external, ↗, new tab); ghost "llms.txt" |
| `#live-pill` "Gateway operational · Status ↗" / "Live · limiter: redis" | `.status` readout (word + detail); its link to status.mikeodnis.dev -> footer `.status-pill` |
| `#status-foot` "Core v1.0.0 · uptime 193168s · rate-limiter redis" | merged into `.status-detail`: "limiter redis · core v1.0.0 · up 2d 5h" |
| `.grid-4` "Mounted services" 4 tiles | `.card-row` with 4 `.card`, `.card-route` values `/v1/core`, `/v1/media`, `/v1/links/graphql`, `/health`; labels "ElysiaJS&nbsp;· Bun", "Go&nbsp;· Chi", "Hasura GraphQL", "Observability"; meta = old `.stat-sub` |
| "Rate-Limit Policies (IETF Draft Headers)" tile + table | section "Rate-limit policies (IETF draft headers)", meta "6 tiers"; `.tile-intro` = old paragraph; `.ref-table` Service, Tier (`.badge`), Quota (`data-label`, `.cell-nowrap`), Keying (`data-label`, `.cell-desc`); same 6 rows |
| "Working Quick-Start Examples" | `.split` left: "Working quick-start examples", two `.step`s, same commands |
| "OpenAPI, LLM & Security Discovery" table | `.split` right: "OpenAPI, LLM &amp; security discovery", same intro, 6 `.discovery` rows, same links |
| FAQ (2) | `.faq-item` x2, first open ("Yes —" -> "Yes.") |
| footer "© 2026 Mike Odnis · WomB0ComB0/api (Apache-2.0)" | `.footer-line` (Apache-2.0 -> LICENSE on master, 2025-present ©, Mike Odnis) + repo link line; nav Portfolio • Links • Blog • News • CDN • OSS; Status pill |
| JSON-LD, `Link` headers, JSON content negotiation | unchanged |
| `docs.html` | unchanged (Scalar). Optional title `Reference - API` |

### cdn.mikeodnis.dev (`renderCdnHomePage()` in `cloudflare-worker/src/api/pages.ts`)

| Old element | New block |
|---|---|
| `nav.constellation` (8 links, CDN current) | site menu `*.mikeodnis.dev` group (CDN = `here`); footer nav |
| `.label-mono` "Edge Asset Delivery · Cloudflare Workers + R2" | `.page-stack` "Edge asset delivery&nbsp;· Cloudflare Workers + R2" |
| `h1` "cdn.mikeodnis.dev" | `.page-eyebrow` "cdn.mikeodnis.dev"; `h1.page-title` "CDN" |
| lede | `.page-lede` (unchanged text) |
| buttons: Open Upload Studio (PWA) →, OpenAPI Docs (Scalar), Media API Docs, llms.txt, openapi.yaml | primary "Open Upload Studio (PWA)" `/upload`; ghost "OpenAPI docs (Scalar)" `/docs`; ghost "Media API docs" `${API_ORIGIN}/docs` (external, ↗); ghost "llms.txt"; ghost "openapi.yaml" |
| `#live-pill` "Edge operational · Status ↗" | `.status` readout; status link -> footer `.status-pill` |
| `#metrics-foot` "Edge status: healthy · limiter: edge" | merged into `.status-detail`: "edge healthy · limiter edge" |
| `.grid-3` "Edge capabilities" 3 tiles | `.card-row` with 3 `.card`: label "Public assets" / "Private signed" / "Image transforms"; value `.card-figure` 300/120/60 + `.card-unit` "req / 60s"; meta = old `.stat-sub` |
| "Edge Route Reference" table | section "Edge route reference", meta "5 routes"; columns Method (`.badge` GET), Path (`.cell-code`), Auth (`data-label`), Behavior &amp; cache (`data-label`, `.cell-desc`); same 5 rows |
| "Quick Start Examples" | `.split` left: "Quick start examples", 2 steps, same commands |
| "Machine & LLM Discovery" table | `.split` right: "Machine &amp; LLM discovery", same intro, 6 rows |
| FAQ (3) | `.faq-item` x3, first open |
| footer "© 2026 Mike Odnis · WomB0ComB0/cdn (Apache-2.0)" | `.footer-line` (LICENSE on main) + repo link; nav Portfolio • Links • Blog • News • API • OSS; Status pill |
| JSON-LD, manifest link, `Link` header, JSON for `Accept: application/json` | unchanged |

## 10. Repo notes for implementers

- **cdn tests** (`src/__tests__/discovery.test.ts`) assert that the home HTML contains
  `cdn.mikeodnis.dev`, `*.mikeodnis.dev`, `class="light-rays"`, `/upload` and
  `application/ld+json`. The new markup keeps all five. Add assertions for `/_brand/fonts/`
  (font route: 200, `font/woff2`, immutable) and for the absence of the em dash in `<title>`.
- **Upload Studio** (`renderUploadStudioPage`) still uses `LIVE_CONSOLE_CSS` and
  `LIGHT_RAYS_HTML` (`.constellation`, `.btn-sm`, `.btn-danger`, its own form classes). Leave both
  constants in place for it in this change; switch only the home page to `SUBDOMAIN_CSS`. Its
  title may move to `Upload Studio - CDN`.
- `router.ts` CSPs and the Caddy `@root_html` CSP need no change; `/docs` CSPs are untouched.
- The class names are new (`.tile`, `.btn` and `.badge` exist in both but with new rules). Do not
  mix old and new CSS on one page.
- Keep `subdomain.css` identical on both sites (the header says `v1 (2026-11-26)`); see section 0
  for how to change it.

## 11. Verification (what was run when v1 was built)

- Real root CSP served locally: no CSP violations; Geist and Geist Mono both report `loaded` in
  `document.fonts`; no failed font or stylesheet requests.
- 1440x900 and 375x812: no horizontal overflow (`scrollWidth <= clientWidth`), no element past
  the viewport except inside `.code`/`.table-wrap`. At 820 wide the cards go 2+1, the last
  spanning.
- Keyboard: skip link first (visible 149x44 at 16,16), then rail items, then actions; Esc closes
  the menu.
- Reduced motion: rays static at 0.504 opacity, live dot static.
- WCAG contrast over the CSS tokens: 34/34 text and background pairs pass (lowest: fg-faint on
  surface-3, 4.65:1).
- After a change, re-run the same checks against both pages at 320/375/768/1024/1440, next to
  mikeodnis.dev and links.mikeodnis.dev.

## 12. Revisions after review (integrated on both sites)

The stylesheet stays "v1" (nothing had shipped); these changes are in the stylesheet and in both
sites' byte-identical copies:

- `html` scroll-padding from core/links (focus never lands under the phone bar or the haze).
- Footer Status pill dot is static; only the header readout pulses (also under reduced motion).
- Desktop flyout: left 71px, no divider above the first visible group, 2px row gap, 4px top pad on
  a label under a divider. Now 475px tall, the same as core's and links'.
- Site menu icons: faint only on rows that leave the site.
- `.badge` 24px (4px vertical padding), `.cell-code` `overflow-wrap: break-word`.
- Phone sheet header 90% alpha (links' `bg-surface-1/90`); bar helper 12px inline padding (`px-3`).
- Markup on both sites: `role="dialog"` on `#site-menu`, `aria-label="Docs: {API|CDN}
  reference"` on the bar helper, new-tab treatment on the api FAQ's inline cdn link.
