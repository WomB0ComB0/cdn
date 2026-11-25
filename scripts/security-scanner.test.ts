import { describe, expect, test } from 'bun:test';
import { isPrivateOrReservedIp, validateIngestArgs } from './ingest-open-pdf.js';
import {
  checkMalwareBazaarHash,
  scanBufferSecurity,
  scanPdfBuffer,
  scanSvgBuffer,
  scanZipBuffer,
  sha256Hex,
} from './lib/security-scanner.js';

/** Builds a minimal uncompressed (STORE) ZIP buffer with exact EOCD + Central Directory headers. */
function buildMinimalZip(entries: ReadonlyArray<{ readonly name: string; readonly content: string }>): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const dataBytes = enc.encode(entry.content);

    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    localParts.push(local);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    cdParts.push(cd);

    offset += local.length;
  }

  const cdSize = cdParts.reduce((sum, p) => sum + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + cdSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of [...localParts, ...cdParts, eocd]) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

describe('cdn security scanner & open-PDF ingest pipeline', () => {
  test('scanPdfBuffer accepts clean PDFs and rejects active objects, hex-obfuscation, and polyglots', () => {
    const enc = new TextEncoder();
    expect(
      scanPdfBuffer(
        enc.encode(
          '%PDF-1.7\n1 0 obj << /Type /Catalog /OpenAction [3 0 R /Fit] >> endobj\nstream\nrandom /JS /AA binary\nendstream\n%%EOF\n'
        )
      )
    ).toEqual([]);

    expect(
      scanPdfBuffer(enc.encode('%PDF-1.7\n1 0 obj << /OpenAction << /S /JS /JS (1) >> >> endobj'))
        .length
    ).toBeGreaterThan(0);
    expect(
      scanPdfBuffer(enc.encode('%PDF-1.7\n1 0 obj << /J#61vaScript (alert(1)) >> endobj'))[0]
    ).toContain('pdf_obfuscated_active_object');
    expect(scanPdfBuffer(enc.encode('%PDF-1.7\n<html><script>alert(1)</script></html>'))).toContain(
      'pdf_html_script_polyglot'
    );
  });

  test('scanSvgBuffer blocks direct and entity-encoded XSS payloads', () => {
    const enc = new TextEncoder();
    expect(
      scanSvgBuffer(enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'))
    ).toEqual([]);
    expect(
      scanSvgBuffer(enc.encode('<svg><a href="&#x6a;avascript:alert(1)"/></svg>'))
    ).toContain('svg_entity_encoded_active_content');
  });

  test('scanZipBuffer allows clean archives and blocks zip-slip, executables, and double extensions', () => {
    const clean = buildMinimalZip([{ name: 'docs/guide.md', content: '# OK' }]);
    expect(scanZipBuffer(clean)).toEqual([]);

    const slip = buildMinimalZip([{ name: '../../etc/passwd', content: 'x' }]);
    expect(scanZipBuffer(slip)[0]).toContain('zip_slip_traversal');

    const exe = buildMinimalZip([{ name: 'dropper.exe', content: 'MZ' }]);
    expect(scanZipBuffer(exe)[0]).toContain('zip_dangerous_entry_ext');

    const doubleExt = buildMinimalZip([{ name: 'book.pdf.js', content: 'evil()' }]);
    expect(scanZipBuffer(doubleExt)).toContain('zip_double_extension:book.pdf.js');
  });

  test('scanBufferSecurity enforces magic-byte parity and computes deterministic SHA-256', () => {
    const spoofed = scanBufferSecurity({
      filename: 'cover.png',
      contentType: 'image/png',
      bytes: new TextEncoder().encode('<html><script>alert(1)</script></html>'),
    });
    expect(spoofed.ok).toBe(false);
    expect(spoofed.findings[0]).toContain('magic_mismatch');
    expect(spoofed.sha256).toHaveLength(64);

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const valid = scanBufferSecurity({
      filename: 'cover.png',
      contentType: 'image/png',
      bytes: pngBytes,
    });
    expect(valid.ok).toBe(true);
    expect(valid.detectedType).toBe('png');
    expect(valid.sha256).toBe(sha256Hex(pngBytes));
  });

  test('checkMalwareBazaarHash flags known malicious hashes using hash-only requests', async () => {
    const hit = await checkMalwareBazaarHash('a'.repeat(64), {
      fetcher: async () =>
        new Response(
          JSON.stringify({ query_status: 'ok', data: [{ signature: 'PDF.Exploit.Test' }] }),
          { status: 200 }
        ),
    });
    expect(hit.malicious).toBe(true);
    expect(hit.signature).toBe('PDF.Exploit.Test');

    const clean = await checkMalwareBazaarHash('b'.repeat(64), {
      fetcher: async () =>
        new Response(JSON.stringify({ query_status: 'hash_not_found' }), { status: 200 }),
    });
    expect(clean.checked).toBe(true);
    expect(clean.malicious).toBe(false);
  });

  test('validateIngestArgs enforces open-license allowlist, HTTPS, and SSRF IP policy', () => {
    expect(() =>
      validateIngestArgs({
        url: 'https://example.org/book.pdf',
        slug: 'my-book',
        license: 'All-Rights-Reserved',
      })
    ).toThrow(/allowlist/);

    expect(() =>
      validateIngestArgs({
        url: 'http://example.org/book.pdf',
        slug: 'my-book',
        license: 'CC-BY-4.0',
      })
    ).toThrow(/https/);

    expect(
      validateIngestArgs({
        url: 'https://openstax.org/book.pdf',
        slug: 'psychology-2e',
        license: 'CC-BY-4.0',
      }).slug
    ).toBe('psychology-2e');

    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
  });
});
