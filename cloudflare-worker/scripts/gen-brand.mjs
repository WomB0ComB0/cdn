// Emits src/api/{brandFonts,subdomainDesign}.ts from brand/ (byte for byte): bun run brand.
// brand/ holds the shared subdomain design (docs/design/subdomain-design.md); api.mikeodnis.dev
// serves the same files from services/gateway/static/_brand/ in WomB0ComB0/api.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SHARED = join(ROOT, 'brand');
const OUT = join(ROOT, 'src', 'api');

const b64 = (p) => readFileSync(join(SHARED, 'fonts', p)).toString('base64');
const ofl = readFileSync(join(SHARED, 'fonts', 'OFL.txt'), 'utf8');

writeFileSync(join(OUT, 'brandFonts.ts'), `// Generated: Geist and Geist Mono 1.900 (geist npm 1.9.2, OFL-1.1, no Reserved Font Name), variable
// wght 100-900, subset to the Latin range mikeodnis.dev serves plus arrows U+2190-2199. Shared with
// api.mikeodnis.dev (subdomain design spec v1); served at /_brand/fonts/ by router.ts. The version
// is in each file name, so a new font version needs a new name (the routes cache immutably).
// Do not edit by hand: change brand/fonts and run "bun run brand"; the tests pin their SHA-256.
function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/** /_brand/fonts/geist-v1.9-latin.woff2 */
export const GEIST_WOFF2: Uint8Array = decodeBase64(${JSON.stringify(b64('geist-v1.9-latin.woff2'))});

/** /_brand/fonts/geist-mono-v1.9-latin.woff2 */
export const GEIST_MONO_WOFF2: Uint8Array = decodeBase64(${JSON.stringify(b64('geist-mono-v1.9-latin.woff2'))});

/** /_brand/fonts/OFL.txt: the licence that must ship with the fonts. */
export const GEIST_OFL_TXT: string = ${JSON.stringify(ofl)};
`);

const css = readFileSync(join(SHARED, 'subdomain.css'), 'utf8');
const sprite = readFileSync(join(SHARED, 'icon-sprite.svg.html'), 'utf8');
for (const [name, text] of [['css', css], ['sprite', sprite]]) {
  if (/[`\\]|\$\{|<\/style/i.test(text)) throw new Error(name + ' cannot go into a template literal verbatim');
}

writeFileSync(join(OUT, 'subdomainDesign.ts'), `// Generated: the shared subdomain design (spec v1) used verbatim by cdn.mikeodnis.dev and
// api.mikeodnis.dev. Do not edit by hand or fork per site: change brand/ (and the api repo's copy),
// then run "bun run brand". The tests pin the SHA-256 of both strings.

/** subdomain.css v1, byte for byte. Inlined in <style> by renderCdnHomePage(). */
export const SUBDOMAIN_CSS: string = \`${css}\`;

/** Inline <svg class="icon-sprite">: 16 heroicons outline symbols (MIT), referenced as #i-NAME. */
export const ICON_SPRITE_SVG: string = \`${sprite}\`;
`);
console.log('ok');
