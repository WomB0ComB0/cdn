// Generated: the shared subdomain design (spec v1) used verbatim by cdn.mikeodnis.dev and
// api.mikeodnis.dev. Do not edit by hand or fork per site: change the shared files, then copy them to
// both sites. The tests pin the SHA-256 of both strings.

/** subdomain.css v1, byte for byte. Inlined in <style> by renderCdnHomePage(). */
export const SUBDOMAIN_CSS: string = `/*
 * Copyright 2026 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * subdomain.css v1 (2026-11-26): the Live Console design of mikeodnis.dev for the static subdomain roots
 * (api.mikeodnis.dev, cdn.mikeodnis.dev). Plain CSS, no build step. Both roots use this file
 * verbatim, inlined in <style> or served at /_brand/subdomain.css.
 *
 * Token names and values are the core's (portfolio src/styles/globals.css, the first :root
 * block) and links.mikeodnis.dev's (app/assets/css/main.css). Values are literals, never
 * color-mix() or relative colours, so every browser that reads oklch() paints the same thing.
 * Markup contract: shared/spec.md.
 */

/* ---------------------------------------------------------------- fonts */

/*
 * Geist and Geist Mono 1.900 (OFL-1.1, the geist npm package), variable weight, subset to the
 * Latin range core serves plus arrows (U+2190-2199). Same-origin path on both sites.
 */
@font-face {
  font-family: "Geist";
  src: url("/_brand/fonts/geist-v1.9-latin.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
    U+0329, U+2000-206F, U+20AC, U+2122, U+2190-2199, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Geist Mono";
  src: url("/_brand/fonts/geist-mono-v1.9-latin.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
    U+0329, U+2000-206F, U+20AC, U+2122, U+2190-2199, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* next/font's metric-matched Arial for Geist (core's own values), so the swap barely moves text. */
@font-face {
  font-family: "Geist Fallback";
  src: local("Arial");
  ascent-override: 95.94%;
  descent-override: 28.16%;
  line-gap-override: 0%;
  size-adjust: 104.76%;
}

/* --------------------------------------------------------------- tokens */

:root {
  color-scheme: dark;

  /* Surfaces, darkest first. Tiles on surface-1 always carry a hairline border. */
  --canvas: oklch(16% 0.016 285deg);
  --surface-1: oklch(20% 0.02 285deg);
  --surface-2: oklch(23.5% 0.025 285deg);
  --surface-3: oklch(27% 0.028 285deg);
  --sticky-canvas: oklch(16% 0.016 285deg / 89%);
  --hairline: oklch(30% 0.03 285deg);
  --hairline-strong: oklch(40% 0.04 285deg);

  /* Text tiers. Each meets 4.5:1 on the canvas and on all three surfaces. */
  --fg: oklch(94% 0.03 285deg);
  --fg-muted: oklch(74% 0.038 285deg);
  --fg-faint: oklch(65% 0.03 285deg);

  /* Brand. brand-ink is brand-coloured text and links; brand-subtle is a selected fill. */
  --brand: oklch(65% 0.12 285deg);
  --brand-ink: oklch(76% 0.1 285deg);
  --brand-subtle: oklch(30% 0.07 285deg);

  /* Status colours. Always shown next to a word, never colour alone. */
  --live: oklch(80% 0.18 152deg);
  --ongoing: oklch(80% 0.123 80deg);
  --down: oklch(72% 0.15 25deg);
  --info: oklch(76% 0.1 235deg);
  --live-halo: oklch(80% 0.18 152deg / 20%);

  /* Translucent brand light: glows, rims and halos. */
  --brand-glow: oklch(65% 0.12 285deg / 9%);
  --brand-edge: oklch(65% 0.12 285deg / 18%);
  --brand-rim: oklch(65% 0.12 285deg / 80%);
  --brand-halo: oklch(65% 0.12 285deg / 10%);
  --light-rays: rgb(88 68 188);

  /* The one focus ring colour (at least 3:1 on every surface). */
  --focus: oklch(76% 0.1 285deg);

  /* Type. Geist for everything people read, Geist Mono only for machine tokens. */
  --font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, sfmono-regular, menlo, monospace;
  --text-label: 0.75rem;
  --text-meta: 0.8125rem;
  --text-body-sm: 0.875rem;
  --text-body: 1rem;
  --tracking-label: 0.08em;

  /* Shape and depth. */
  --radius: 0.5rem;
  --radius-md: 0.375rem;
  --radius-tile: 0.75rem;
  --shadow-raised:
    inset 0 1px 0 0 oklch(100% 0 0deg / 5%), 0 8px 24px -8px oklch(0% 0 0deg / 55%);

  /* Motion. */
  --motion-instant: 100ms;
  --motion-fast: 150ms;
  --motion-base: 240ms;
  --motion-slow: 400ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-effect: cubic-bezier(0.34, 0.8, 0.34, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  /* Layout. */
  --container-shell: 75rem;
  --page-gutter: clamp(1rem, 0.5rem + 2vw, 2rem);
  --rail-w: 4rem;
  --mobile-bar-h: 4.5rem;
  --mobile-bar-total: calc(var(--mobile-bar-h) + env(safe-area-inset-bottom, 0px));
  --edge-haze-h: clamp(min(77px, 14svh), 11svh, 132px);
}

/* ----------------------------------------------------------------- base */

*,
*::before,
*::after {
  box-sizing: border-box;
  border: 0 solid var(--hairline);
}

html {
  background-color: var(--canvas);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 100%;
  line-height: 1.625;
  text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-tap-highlight-color: transparent;
  tab-size: 4;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
  scrollbar-color: oklch(65% 0.12 285deg / 70%) transparent;
  accent-color: var(--brand);
}

/*
 * Focus and #hash targets stop clear of the edge haze and, on a phone, the bottom bar, as on
 * core and links (WCAG 2.4.11 Focus Not Obscured). From 64rem the top edge also clears 4.625rem.
 */
html {
  scroll-padding-block: calc(var(--edge-haze-h) + env(safe-area-inset-top, 0px))
    calc(var(--edge-haze-h) + var(--mobile-bar-total));
}

@media (width >= 64rem) {
  html {
    scroll-padding-block: max(calc(var(--edge-haze-h) + env(safe-area-inset-top, 0px)), 4.625rem)
      var(--edge-haze-h);
  }
}

body {
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  margin: 0;
  overflow-x: clip;
  background-color: var(--canvas);
}

h1,
h2,
h3,
p,
ul,
ol,
dl,
dd,
pre,
figure {
  margin: 0;
}

h1,
h2,
h3 {
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}

a {
  color: var(--brand-ink);
  text-decoration: none;
  text-underline-offset: 0.2em;
  transition: color var(--motion-fast) var(--ease-standard);
}

/* A link inside running text is underlined, so it never relies on colour alone. */
:where(p, li, td, dd) a:not([class]) {
  text-decoration: underline dotted;
  text-underline-offset: 4px;
}

:where(p, li, td, dd) a:not([class]):hover {
  color: var(--fg);
}

code,
kbd,
samp,
pre {
  font-family: var(--font-mono);
}

code {
  font-size: 0.9em;
}

/* Machine tokens inside muted copy step up to fg, so they read as tokens without a box. */
:where(.page-lede, .tile-intro, .step-label, .card-meta, .cell-desc, .faq-body, .discovery-desc)
  code {
  color: var(--fg);
}

svg {
  flex-shrink: 0;
}

:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

::selection {
  background-color: var(--brand-subtle);
  color: var(--fg);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Core's skip link: sr-only until focused, then a raised chip at the top left. */
.skip-link:not(:focus) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.skip-link:focus {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 100;
  padding: 0.5rem 1rem;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-md);
  background-color: var(--surface-2);
  color: var(--fg);
  font-weight: 500;
  box-shadow: var(--shadow-raised);
}

/* The icon sprite holds <symbol>s only. */
.icon-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.icon {
  width: 1rem;
  height: 1rem;
}

/* ---------------------------------------------------------- atmosphere */

/* The two faint violet glows behind every Live Console page. */
.light-glows {
  background-image:
    radial-gradient(circle at 20% 15%, rgb(88 68 188 / 5.4%), transparent 70%),
    radial-gradient(circle at 80% 10%, rgb(88 68 188 / 4.2%), transparent 75%);
  background-repeat: no-repeat;
}

/* Five slow light rays from the top edge (core's light-rays.css; the same five rays). */
.light-rays {
  --ray-page: 2040px;

  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

@media (width >= 40rem) {
  .light-rays {
    --ray-page: 1340px;
  }
}

@media (width >= 80rem) {
  .light-rays {
    --ray-page: 954px;
  }
}

.light-rays > i {
  --ray-cycle: calc(var(--ray-duration) * 1.1);

  position: absolute;
  top: calc(max(var(--ray-page), 100vh) * -0.12);
  left: var(--ray-left);
  width: var(--ray-width);
  height: 70vh;
  border-radius: 9999px;
  background: linear-gradient(to bottom, rgb(88 68 188 / 14%), transparent);
  filter: blur(20px);
  opacity: 0;
  translate: -50% 0;
  rotate: var(--ray-rotate);
  transform-origin: 50% 0;
  animation: light-ray var(--ray-cycle) ease-in-out calc(var(--ray-delay) - var(--ray-cycle))
    infinite;
}

.light-rays > i:nth-child(1) {
  --ray-left: 90.5%;
  --ray-width: 221px;
  --ray-rotate: -7.9deg;
  --ray-swing: 2.5deg;
  --ray-duration: 12s;
  --ray-delay: 12.2s;
  --ray-peak: 0.84;
}

.light-rays > i:nth-child(2) {
  --ray-left: 21.7%;
  --ray-width: 272px;
  --ray-rotate: -24deg;
  --ray-swing: 2deg;
  --ray-duration: 17.2s;
  --ray-delay: 4.7s;
  --ray-peak: 0.72;
}

.light-rays > i:nth-child(3) {
  --ray-left: 38.8%;
  --ray-width: 307px;
  --ray-rotate: 10.6deg;
  --ray-swing: 1.1deg;
  --ray-duration: 16.5s;
  --ray-delay: 11.6s;
  --ray-peak: 0.73;
}

.light-rays > i:nth-child(4) {
  --ray-left: 53.5%;
  --ray-width: 271px;
  --ray-rotate: 16deg;
  --ray-swing: 1.9deg;
  --ray-duration: 15s;
  --ray-delay: 2.9s;
  --ray-peak: 0.86;
}

.light-rays > i:nth-child(5) {
  --ray-left: 20.6%;
  --ray-width: 258px;
  --ray-rotate: 12.4deg;
  --ray-swing: 1.9deg;
  --ray-duration: 15.1s;
  --ray-delay: 1.3s;
  --ray-peak: 0.81;
}

@keyframes light-ray {
  0% {
    opacity: 0;
    rotate: calc(var(--ray-rotate) - var(--ray-swing));
  }

  45.45% {
    opacity: var(--ray-peak);
    rotate: calc(var(--ray-rotate) + var(--ray-swing));
  }

  90.91%,
  100% {
    opacity: 0;
    rotate: calc(var(--ray-rotate) - var(--ray-swing));
  }
}

/*
 * The scroll edge haze, one layer per band (core stacks eight): canvas tint plus a 6px blur,
 * eased to nothing. It only appears once the page scrolls, so a short page never shows it.
 * Never give .edge-haze itself opacity, a filter or a mask: it would cut the blur off.
 */
.edge-haze {
  position: fixed;
  inset: 0 0 var(--mobile-bar-total);
  z-index: 20;
  pointer-events: none;
}

@media (width >= 64rem) {
  .edge-haze {
    inset: 0 0 0 var(--rail-w);
  }
}

.edge-haze::before,
.edge-haze::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  height: var(--edge-haze-h);
  opacity: 0;
}

@supports (animation-timeline: scroll()) and (backdrop-filter: blur(1px)) {
  .edge-haze::before,
  .edge-haze::after {
    backdrop-filter: blur(6px);
    animation: haze-in linear both;
    animation-timeline: scroll(root block);
  }

  .edge-haze::before {
    top: 0;
    background: linear-gradient(
      to bottom,
      oklch(16% 0.016 285deg / 59%),
      oklch(16% 0.016 285deg / 21%) 57%,
      transparent
    );
    mask-image: linear-gradient(to bottom, #000 30%, transparent);
    animation-range: 0 5rem;
  }

  .edge-haze::after {
    bottom: 0;
    background: linear-gradient(
      to top,
      oklch(16% 0.016 285deg / 59%),
      oklch(16% 0.016 285deg / 21%) 57%,
      transparent
    );
    mask-image: linear-gradient(to top, #000 30%, transparent);
    animation-name: haze-out;
    animation-range: calc(100% - 5rem) 100%;
  }
}

@keyframes haze-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes haze-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

/* --------------------------------------------------------------- frame */

.page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: var(--mobile-bar-total);
}

@media (width >= 64rem) {
  .page {
    padding-bottom: 0;
    padding-left: var(--rail-w);
  }
}

/* The page column: core's max-w-shell main with PageShell's gutter. A size container. */
.shell {
  container: page / inline-size;
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  max-width: var(--container-shell);
  margin-inline: auto;
  padding: 1.5rem var(--page-gutter);
  outline: none;
}

@media (width >= 48rem) {
  .shell {
    padding-block: 2.5rem;
  }
}

/* ------------------------------------------------------------ the rail */

/* Desktop chrome: core's 64px icon rail. Hidden below 64rem, where the bottom bar takes over. */
.rail {
  display: none;
}

@media (width >= 64rem) {
  .rail {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: var(--rail-w);
    padding-block: 1.5rem;
    border-right-width: 1px;
    background-color: oklch(16% 0.016 285deg / 80%);
    backdrop-filter: blur(12px);
  }
}

.rail-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding-inline: 0.5rem;
}

.rail-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border-radius: var(--radius);
  background-color: transparent;
  color: var(--fg-muted);
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}

.rail-item .icon {
  width: 1.125rem;
  height: 1.125rem;
}

.rail-item:hover,
body:has(#site-menu:popover-open) .rail-item[popovertarget] {
  background-color: var(--surface-2);
  color: var(--fg);
}

.rail-item[aria-current="page"] {
  background-color: var(--surface-3);
  color: var(--fg);
}

/* The current page's brand tick on the rail's edge. */
.rail-item[aria-current="page"]::before {
  content: "";
  position: absolute;
  top: 50%;
  left: -0.625rem;
  width: 2px;
  height: 1.25rem;
  border-radius: 9999px;
  background-color: var(--brand);
  translate: 0 -50%;
}

.rail-tip {
  position: absolute;
  top: 50%;
  left: 100%;
  z-index: 50;
  margin-left: 1rem;
  padding: 0.375rem 0.625rem;
  border-width: 1px;
  border-radius: var(--radius-md);
  background-color: var(--surface-2);
  color: var(--fg);
  font-size: var(--text-body-sm);
  line-height: 1.375rem;
  white-space: nowrap;
  box-shadow: var(--shadow-raised);
  opacity: 0;
  pointer-events: none;
  translate: 0 -50%;
  transition: opacity var(--motion-fast) var(--ease-standard);
}

.rail-item:hover .rail-tip,
.rail-item:focus-visible .rail-tip {
  opacity: 1;
}

body:has(#site-menu:popover-open) .rail-item[popovertarget] .rail-tip {
  opacity: 0;
}

.rail-sep {
  width: 2rem;
  height: 1px;
  margin-block: 0.25rem;
  background-color: var(--hairline);
}

/* ------------------------------------------------------ the bottom bar */

/* Phone chrome: core's bottom bar, a Menu pill plus one round helper. */
.mobile-bar {
  position: fixed;
  inset: auto 0 0;
  z-index: 50;
  display: flex;
  align-items: center;
  height: var(--mobile-bar-total);
  padding: 0 1rem env(safe-area-inset-bottom, 0px);
  border-top-width: 1px;
  background-color: oklch(16% 0.016 285deg / 85%);
  backdrop-filter: blur(12px);
}

@media (width >= 64rem) {
  .mobile-bar {
    display: none;
  }
}

.mobile-bar-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 28rem;
  margin-inline: auto;
}

.bar-btn {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  height: 2.75rem;
  padding: 0 1.25rem;
  border-width: 1px;
  border-radius: 9999px;
  background-color: var(--surface-2);
  color: var(--fg);
  font: 500 var(--text-body-sm) / 1.375rem var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard);
}

.bar-btn:hover {
  border-color: var(--hairline-strong);
  background-color: var(--surface-3);
}

.bar-btn .icon {
  width: 1.125rem;
  height: 1.125rem;
}

/* The round helper beside Menu (core: search; here: the site's reference docs). */
.bar-btn-aux {
  flex: none;
  justify-content: center;
  gap: 0.5rem;
  min-width: 2.75rem;
  padding-inline: 0.75rem;
}

.bar-btn-aux .icon {
  width: 1rem;
  height: 1rem;
}

.bar-btn-aux span {
  color: var(--fg-muted);
  font: 400 var(--text-meta) / 1.125rem var(--font-mono);
}

/* -------------------------------------------------- the site menu sheet */

/*
 * One popover (#site-menu) is both chrome menus, as the HTML popover API needs no script:
 * a bottom sheet from the phone bar, and the rail's network flyout from 64rem, where the
 * sheet's header and this-site group are hidden (the rail already shows them).
 */
.menu[popover] {
  position: fixed;
  inset: auto 0 0;
  width: 100%;
  max-width: none;
  max-height: 85dvh;
  margin: 0;
  padding: 0 0 env(safe-area-inset-bottom, 0px);
  overflow-y: auto;
  overscroll-behavior: contain;
  border-top-width: 1px;
  border-radius: var(--radius-tile) var(--radius-tile) 0 0;
  background-color: var(--surface-1);
  color: var(--fg);
  box-shadow: var(--shadow-raised);
}

.menu[popover]::backdrop {
  background-color: oklch(16% 0.016 285deg / 70%);
  backdrop-filter: blur(4px);
}

.menu-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.75rem 0.75rem 1.5rem;
  border-bottom-width: 1px;
  background-color: oklch(20% 0.02 285deg / 90%);
  backdrop-filter: blur(12px);
}

.menu-title {
  font-size: var(--text-body);
  line-height: 1.625rem;
}

.menu-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border-width: 1px;
  border-radius: 9999px;
  background-color: var(--surface-2);
  color: var(--fg-muted);
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}

.menu-close:hover {
  background-color: var(--surface-3);
  color: var(--fg);
}

.menu-close .icon {
  width: 1.125rem;
  height: 1.125rem;
}

.menu-body {
  padding: 0.75rem 0.75rem 1.5rem;
}

.menu-group + .menu-group {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top-width: 1px;
}

.menu-group-label {
  padding: 0 0.75rem 0.375rem;
  color: var(--fg-faint);
  font: 400 var(--text-label) / 1rem var(--font-mono);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.menu-list {
  display: grid;
  gap: 0.25rem;
  padding: 0;
  list-style: none;
}

@media (width >= 40rem) and (width < 64rem) {
  .menu-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.menu-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  color: var(--fg);
  font-size: var(--text-body-sm);
  line-height: 1.375rem;
  transition: background-color var(--motion-fast) var(--ease-standard);
}

.menu-link:hover {
  background-color: var(--surface-3);
}

.menu-link .icon {
  color: var(--fg-faint);
}

/* Only rows that leave the site dim their icon; this site's own pages keep fg, as on links. */
.menu-link:not([target="_blank"]) .icon {
  color: inherit;
}

.menu-link-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-link .icon-ext {
  width: 0.875rem;
  height: 0.875rem;
}

.menu-link[aria-current="page"] {
  background-color: var(--brand-subtle);
  color: var(--brand-ink);
  font-weight: 500;
}

.menu-link[aria-current="page"] .icon {
  color: inherit;
}

.menu-here {
  color: var(--brand-ink);
  font: 400 var(--text-label) / 1rem var(--font-mono);
}

@media (width >= 64rem) {
  .menu[popover] {
    inset: auto;
    top: 11.25rem;
    left: calc(var(--rail-w) + 0.4375rem);
    width: auto;
    min-width: 15rem;
    max-height: calc(100dvh - 2rem);
    padding: 0.375rem;
    border-width: 1px;
    border-radius: var(--radius-tile);
    background-color: var(--surface-2);
  }

  .menu[popover]::backdrop {
    background-color: transparent;
    backdrop-filter: none;
  }

  .menu-head,
  .menu-group-site {
    display: none;
  }

  .menu-body {
    padding: 0;
  }

  .menu-group-label {
    padding: 0.5rem 0.625rem 0.25rem;
  }

  .menu-group + .menu-group {
    margin-top: 0.375rem;
    padding-top: 0.375rem;
  }

  /* A label under a divider sits closer to it (links: pt-1 after the hairline, pt-2 on top). */
  .menu-group + .menu-group .menu-group-label {
    padding-top: 0.25rem;
  }

  /* The this-site group is hidden here, so the first visible group gets no divider. */
  .menu-group-site + .menu-group {
    margin-top: 0;
    padding-top: 0;
    border-top-width: 0;
  }

  .menu-group-site + .menu-group .menu-group-label {
    padding-top: 0.5rem;
  }

  .menu-list {
    gap: 0.125rem;
  }

  .menu-link {
    min-height: 0;
    padding: 0.5rem 0.625rem;
  }
}

/*
 * Where CSS anchor positioning exists, the flyout's top follows the rail's network button;
 * elsewhere 11.25rem is that button's top (1.5rem padding + three 2.75rem items, 0.5rem gaps).
 * Its left sits 7px past the rail's edge (x = 71px), where core's and links' flyouts sit.
 */
@supports (anchor-name: --a) {
  .rail-item[popovertarget] {
    anchor-name: --site-menu-anchor;
  }

  @media (width >= 64rem) {
    .menu[popover] {
      position-anchor: --site-menu-anchor;
      top: anchor(top);
    }
  }
}

/* --------------------------------------------------------- page header */

/* PageShell: eyebrow, the one h1, a lede, actions; the live status at the end. */
.page-header {
  display: grid;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom-width: 1px;
}

.page-heading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.page-eyebrow {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: 500;
  line-height: 1rem;
}

.page-title {
  color: var(--fg);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
}

.page-lede {
  max-width: 60ch;
  color: var(--fg-muted);
  font-size: var(--text-body);
  line-height: 1.625rem;
}

.page-stack {
  color: var(--fg-faint);
  font: 400 var(--text-label) / 1rem var(--font-mono);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.page-aside {
  display: flex;
  align-items: center;
  min-width: 0;
}

@container page (width >= 48rem) {
  .page-header {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    column-gap: 1.5rem;
    padding-bottom: 1.25rem;
  }

  .page-title {
    font-size: 2.75rem;
    line-height: 1.05;
    letter-spacing: -0.04em;
  }

  /* The status sits level with the actions row. */
  .page-aside {
    padding-bottom: 0.375rem;
  }
}

/* -------------------------------------------------------------- buttons */

/* Core's hero pills: 44px tall, 14/20 at 500. Filled brand for the one primary action. */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 2.75rem;
  padding: 0.5rem 1rem;
  border-width: 1px;
  border-color: var(--hairline);
  border-radius: 9999px;
  background-color: transparent;
  color: var(--fg);
  font: 500 var(--text-body-sm) / 1.25rem var(--font-sans);
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}

.btn:hover {
  border-color: var(--hairline-strong);
  background-color: var(--surface-3);
}

.btn-primary {
  padding-inline: 1.25rem;
  border-color: var(--brand);
  background-color: var(--brand);
  color: var(--canvas);
}

.btn-primary:hover {
  border-color: var(--brand-ink);
  background-color: var(--brand-ink);
}

.btn .icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* --------------------------------------------------------------- status */

/*
 * The page's one live readout, borderless as links' "Live" is: a dot, a status word and a mono
 * detail that wraps under the word on a phone. data-tone drives it. The footer's Status pill is
 * the page's only bordered status (and its only link to status.mikeodnis.dev).
 */
.status {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 0.5rem;
  max-width: 100%;
  min-height: 2rem;
  color: var(--fg);
  font-size: var(--text-body-sm);
  font-weight: 500;
  line-height: 1.375rem;
}

.status-dot {
  display: inline-block;
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: var(--fg-faint);
}

.status-detail {
  color: var(--fg-muted);
  font: 400 var(--text-label) / 1.375rem var(--font-mono);
}

.status-detail:empty {
  display: none;
}

[data-tone="live"] .status-dot {
  background-color: var(--live);
}

/* Only the header readout pulses; the footer Status pill's dot stays still, as core's does. */
.status[data-tone="live"] .status-dot {
  animation: live-pulse 2.4s var(--ease-standard) infinite;
}

[data-tone="live"] .status-word {
  color: var(--live);
}

[data-tone="ongoing"] .status-dot {
  background-color: var(--ongoing);
}

[data-tone="ongoing"] .status-word {
  color: var(--ongoing);
}

[data-tone="down"] .status-dot {
  background-color: var(--down);
}

[data-tone="down"] .status-word {
  color: var(--down);
}

@keyframes live-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px var(--live-halo);
  }

  50% {
    box-shadow: 0 0 0 7px transparent;
  }
}

/* ------------------------------------------------------------- sections */

.section {
  min-width: 0;
  margin-top: 2.5rem;
}

.page-header + .section {
  margin-top: 1.5rem;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  margin-bottom: 1rem;
}

/* Core's section label: sentence case, 13/16 at 500, muted. */
.section-label {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: 500;
  line-height: 1rem;
  letter-spacing: 0;
}

.section-meta {
  color: var(--fg-faint);
  font-size: var(--text-meta);
  line-height: 1.125rem;
  font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------------- tiles */

/* Core's plain tile: surface-1 with a hairline border, 12px radius. */
.tile {
  position: relative;
  min-width: 0;
  padding: 1rem;
  border-width: 1px;
  border-radius: var(--radius-tile);
  background-color: var(--surface-1);
}

/* A tile whose rows run edge to edge (the table, the FAQ). */
.tile-flush {
  padding: 0;
  overflow: hidden;
}

.tile-intro {
  max-width: 75ch;
  color: var(--fg-muted);
  font-size: var(--text-body-sm);
  line-height: 1.375rem;
}

.tile-flush > .tile-intro {
  padding: 1rem 1rem 0.25rem;
}

@container page (width >= 40rem) {
  .tile {
    padding: 1.25rem;
  }

  .tile-flush {
    padding: 0;
  }

  .tile-flush > .tile-intro {
    padding: 1.25rem 1.25rem 0.25rem;
  }
}

/* ---------------------------------------------------------------- cards */

/* One card component, a row of 3 or 4: one column, then two, then all in one row. */
.card-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  padding: 0;
  list-style: none;
}

@container page (width >= 34rem) {
  .card-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-row > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
}

@container page (width >= 60rem) {
  .card-row {
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    grid-template-columns: none;
  }

  .card-row > :last-child:nth-child(odd) {
    grid-column: auto;
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-label {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: 500;
  line-height: 1rem;
}

/* The card's value: a figure and its unit (figure-sm + figure-unit), or a route. */
.card-value {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.375rem;
  min-height: 1.75rem;
}

.card-figure {
  color: var(--fg);
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.card-unit {
  color: var(--fg-muted);
  font-size: var(--text-body-sm);
  line-height: 1.25rem;
}

.card-route {
  color: var(--fg);
  font: 500 1.125rem / 1.75rem var(--font-mono);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.card-meta {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: 1.125rem;
  font-variant-numeric: tabular-nums;
}

/* --------------------------------------------------------------- badges */

/* The one badge, for methods and tiers: links' slug chip (mono-token on brand-subtle). */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  background-color: var(--brand-subtle);
  color: var(--brand-ink);
  font: 400 var(--text-label) / 1rem var(--font-mono);
  white-space: nowrap;
}

/* ---------------------------------------------------------------- table */

.table-wrap {
  overflow-x: auto;
}

.ref-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-body-sm);
  line-height: 1.375rem;
}

/* Core's index-table labels: sentence case, faint, over a strong hairline. */
.ref-table th {
  padding: 1rem 0.75rem 0.5rem;
  border-bottom-width: 1px;
  border-color: var(--hairline-strong);
  color: var(--fg-faint);
  font-size: var(--text-meta);
  font-weight: 500;
  line-height: 1rem;
  text-align: left;
  vertical-align: bottom;
  white-space: nowrap;
}

.ref-table td {
  padding: 0.75rem;
  border-bottom-width: 1px;
  color: var(--fg);
  vertical-align: top;
  transition: background-color var(--motion-base) var(--ease-effect);
}

.ref-table :is(th, td):first-child {
  padding-left: 1rem;
}

.ref-table :is(th, td):last-child {
  padding-right: 1rem;
}

.ref-table tbody tr:last-child td {
  border-bottom-width: 0;
}

.ref-table tbody tr:hover td {
  background-color: var(--surface-2);
  transition-duration: var(--motion-instant);
}

.ref-table .badge {
  vertical-align: 1px;
}

.cell-nowrap {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.cell-code {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  overflow-wrap: break-word;
}

.cell-desc {
  color: var(--fg-muted);
}

@container page (width >= 40rem) {
  .ref-table :is(th, td):first-child {
    padding-left: 1.25rem;
  }

  .ref-table :is(th, td):last-child {
    padding-right: 1.25rem;
  }
}

/*
 * Under 40rem the rows stack, as core's index table does on a phone: the cells without a
 * data-label share the first line, and each labelled cell follows on its own line after
 * its label.
 */
@container page (width < 40rem) {
  .ref-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .ref-table,
  .ref-table tbody {
    display: block;
  }

  .ref-table tr {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.625rem;
    padding: 0.875rem 1rem;
    border-bottom-width: 1px;
  }

  .ref-table tbody tr:last-child {
    border-bottom-width: 0;
  }

  .ref-table td,
  .ref-table :is(th, td):first-child,
  .ref-table :is(th, td):last-child {
    display: block;
    padding: 0;
    border-bottom-width: 0;
  }

  .ref-table td[data-label] {
    flex-basis: 100%;
  }

  .ref-table td[data-label]::before {
    content: attr(data-label);
    margin-right: 0.5rem;
    color: var(--fg-faint);
    font-family: var(--font-sans);
    font-size: var(--text-meta);
    font-weight: 500;
  }

  .ref-table tbody tr:hover td {
    background-color: transparent;
  }
}

/* --------------------------------------------- quick start + discovery */

.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  column-gap: 1rem;
  margin-top: 2.5rem;
}

.split > .section {
  display: flex;
  flex-direction: column;
  margin-top: 0;
}

.split > .section + .section {
  margin-top: 2.5rem;
}

.split > .section > .tile {
  flex: 1;
}

@container page (width >= 56rem) {
  .split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .split > .section + .section {
    margin-top: 0;
  }
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.step-label {
  color: var(--fg-muted);
  font-size: var(--text-body-sm);
  line-height: 1.375rem;
}

/* The one code block: canvas well, hairline, scrolls inside itself (tabindex="0"). */
.code {
  max-width: 100%;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  border-width: 1px;
  border-radius: var(--radius);
  background-color: var(--canvas);
  color: var(--fg);
  font: 400 var(--text-meta) / 1.25rem var(--font-mono);
  white-space: pre;
  tab-size: 2;
  scrollbar-width: thin;
}

.code code {
  font: inherit;
  color: inherit;
}

.discovery {
  display: flex;
  flex-direction: column;
  padding: 0;
  list-style: none;
}

.tile-intro + .discovery {
  margin-top: 0.75rem;
}

.discovery > li {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-block: 0.625rem;
  border-bottom-width: 1px;
}

.discovery > li:last-child {
  padding-bottom: 0;
  border-bottom-width: 0;
}

.discovery-paths {
  color: var(--fg-faint);
  font: 400 var(--text-meta) / 1.25rem var(--font-mono);
  overflow-wrap: anywhere;
}

.discovery-paths a {
  color: var(--brand-ink);
  text-decoration: underline dotted;
  text-underline-offset: 4px;
}

.discovery-paths a:hover {
  color: var(--fg);
}

.discovery-desc {
  color: var(--fg-muted);
  font-size: var(--text-body-sm);
  line-height: 1.25rem;
}

/* ------------------------------------------------------------------ FAQ */

.faq-item + .faq-item {
  border-top-width: 1px;
}

.faq-item > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.75rem 1rem;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: 500;
  line-height: 1.5rem;
  list-style: none;
  cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-standard);
}

.faq-item > summary::-webkit-details-marker {
  display: none;
}

.faq-item > summary:hover {
  background-color: var(--surface-2);
}

.faq-item > summary:focus-visible {
  outline-offset: -2px;
}

/* The chevron: a turned corner, down when closed and up when open. */
.faq-item > summary::after {
  content: "";
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  margin: -0.25rem 0.25rem 0 0;
  border-right: 1.5px solid var(--fg-faint);
  border-bottom: 1.5px solid var(--fg-faint);
  rotate: 45deg;
  transition: rotate var(--motion-base) var(--ease-standard);
}

.faq-item[open] > summary::after {
  margin-top: 0.25rem;
  rotate: 225deg;
}

.faq-body {
  max-width: 75ch;
  padding: 0 1rem 1rem;
  color: var(--fg-muted);
  font-size: var(--text-body-sm);
  line-height: 1.375rem;
}

@container page (width >= 40rem) {
  .faq-item > summary {
    padding-inline: 1.25rem;
  }

  .faq-body {
    padding: 0 1.25rem 1.25rem;
  }
}

/* --------------------------------------------------------------- footer */

/* Core's footer: mono dotted links, separators from 34rem, the Status pill at the end. */
.site-footer {
  container: footer / inline-size;
  width: 100%;
  max-width: var(--container-shell);
  margin: auto auto 0;
  padding: 1.5rem var(--page-gutter);
  border-top-width: 1px;
}

.footer-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: var(--fg-muted);
  font: 400 var(--text-meta) / 1.125rem var(--font-mono);
}

.footer-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.footer-line {
  text-align: center;
}

.footer-link {
  color: var(--brand-ink);
  text-decoration: underline dotted;
  text-underline-offset: 4px;
}

.footer-link:hover {
  color: var(--fg);
}

.footer-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.75rem;
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.footer-sep {
  display: none;
  margin-inline: 0.25rem;
  color: var(--fg-faint);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-width: 1px;
  border-radius: 9999px;
  color: var(--brand-ink);
  font: 500 var(--text-body-sm) / 1.25rem var(--font-mono);
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard);
}

.status-pill:hover {
  border-color: var(--hairline-strong);
  background-color: var(--surface-3);
}

@container footer (width >= 34rem) {
  .footer-nav {
    flex-wrap: nowrap;
    gap: 0.75rem;
    white-space: nowrap;
  }

  .footer-sep {
    display: inline;
  }

  .footer-end {
    gap: 1rem;
  }
}

@container footer (width >= 52rem) {
  .footer-row {
    flex-direction: row;
    justify-content: space-between;
  }

  .footer-start {
    align-items: flex-start;
  }

  .footer-line {
    text-align: left;
  }
}

/* ------------------------------------------------------ menu entrance */

@media (prefers-reduced-motion: no-preference) {
  .menu[popover]:popover-open {
    transition:
      opacity var(--motion-base) var(--ease-effect),
      translate var(--motion-base) var(--ease-out-expo);
  }

  @starting-style {
    .menu[popover]:popover-open {
      opacity: 0;
      translate: 0 1rem;
    }
  }
}

/* ------------------------------------------------ preferences and print */

/*
 * Reduced motion: animations cut to 1ms and transitions to 0s, as core does. The rays stand
 * still at 60% of their peak instead of disappearing.
 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
  }

  .light-rays > i {
    animation-name: none !important;
    opacity: calc(var(--ray-peak) * 0.6);
  }

  .status[data-tone="live"] .status-dot {
    animation: none !important;
    box-shadow: 0 0 0 3px var(--live-halo);
  }
}

@media (prefers-reduced-transparency: reduce) {
  .edge-haze {
    display: none;
  }

  .rail,
  .mobile-bar,
  .menu-head {
    background-color: var(--canvas);
    backdrop-filter: none;
  }
}

@media (forced-colors: active) {
  .light-glows {
    background-image: none;
  }

  .light-rays,
  .edge-haze {
    display: none;
  }

  .status-dot {
    forced-color-adjust: none;
  }
}

@media print {
  .light-glows {
    background-image: none;
  }

  .light-rays,
  .edge-haze,
  .rail,
  .mobile-bar,
  .menu {
    display: none;
  }

  .page {
    padding: 0;
  }

  html {
    scroll-padding-block: 0;
  }
}
`;

/** Inline <svg class="icon-sprite">: 16 heroicons outline symbols (MIT), referenced as #i-NAME. */
export const ICON_SPRITE_SVG: string = `<svg class="icon-sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="m2.25 12l8.955-8.955a1.124 1.124 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></symbol><symbol id="i-book-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M12 6.042A8.97 8.97 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A9 9 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.97 8.97 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A9 9 0 0 0 18 18a8.97 8.97 0 0 0-6 2.292m0-14.25v14.25"/></symbol><symbol id="i-arrow-up-tray" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></symbol><symbol id="i-globe-alt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a9 9 0 0 1 7.843 4.582M12 3a9 9 0 0 0-7.843 4.582m15.686 0A11.95 11.95 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.96 8.96 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.9 17.9 0 0 1 12 16.5a17.9 17.9 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"/></symbol><symbol id="i-code-bracket" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></symbol><symbol id="i-arrow-up-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="m4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"/></symbol><symbol id="i-bars-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></symbol><symbol id="i-x-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M6 18L18 6M6 6l12 12"/></symbol><symbol id="i-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></symbol><symbol id="i-document-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9"/></symbol><symbol id="i-newspaper" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6z"/></symbol><symbol id="i-cpu-chip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25m.75-12h9v9h-9z"/></symbol><symbol id="i-cloud" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257a3 3 0 0 0-3.758-3.848a5.25 5.25 0 0 0-10.233 2.33A4.5 4.5 0 0 0 2.25 15"/></symbol><symbol id="i-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12zm.375 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0"/></symbol><symbol id="i-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M21 8.25c0-2.485-2.099-4.5-4.687-4.5c-1.936 0-3.598 1.126-4.313 2.733c-.715-1.607-2.377-2.733-4.312-2.733C5.098 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12"/></symbol><symbol id="i-briefcase" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18c-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48 48 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A24 24 0 0 1 12 15.75a24 24 0 0 1-7.577-1.22a2 2 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48 48 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a49 49 0 0 0-7.5 0M12 12.75h.008v.008H12z"/></symbol></svg>`;
