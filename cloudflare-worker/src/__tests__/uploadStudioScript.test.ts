import { describe, expect, test } from 'bun:test';
import { renderUploadStudioPage } from '../api/pages.js';

// The Upload Studio's inline script is written inside a TypeScript template literal. A template
// literal turns `\s` into `s` and `\u0000` into a raw control character, so a regex written there
// reaches the browser broken unless the template keeps its backslashes.
const inlineScript = (): string => {
  const html = renderUploadStudioPage();
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match?.[1]) throw new Error('no inline script on the Upload Studio page');
  return match[1];
};

describe('Upload Studio inline script', () => {
  test('parses as JavaScript, so the page can run at all', () => {
    expect(() => new Function(inlineScript())).not.toThrow();
  });

  test('keeps the regex escapes as written', () => {
    const script = inlineScript();
    expect(script).toContain(String.raw`/[\u0000-\u001F\u007F؜‎‏‪-‮⁦-⁩]/`);
    expect(script).toContain(String.raw`const HTML_PREFIX_RE = /^\s*(?:<!doctype\s+html|<html\b|<script\b|<iframe\b|<\?php\b)/i;`);
    expect(script).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  test('still fills in the API and CDN origins', () => {
    const script = inlineScript();
    expect(script).toContain("const API = 'https://api.mikeodnis.dev';");
    expect(script).toContain("const CDN = 'https://cdn.mikeodnis.dev';");
  });
});
