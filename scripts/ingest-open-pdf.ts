/**
 * Open-Licensed PDF Mirror & Content Disarm/Reconstruction (CDR) Ingest Pipeline for cdn.mikeodnis.dev.
 *
 * Guarantees:
 *   1. Strict open-license allowlist (never mirrors All-Rights-Reserved books).
 *   2. SSRF-safe HTTPS download (blocks literal/private/loopback/link-local/CGNAT IPs, caps at 50 MiB).
 *   3. Pre-CDR static PDF active-content & polyglot scan + MalwareBazaar SHA-256 lookup.
 *   4. Content Disarm & Reconstruction (CDR) via Ghostscript (`gs -dSAFER -sDEVICE=pdfwrite`) or `qpdf`
 *      so malformed PDF parser streams/exploits are rebuilt cleanly before touching R2.
 *   5. Post-CDR verification scan + ClamAV (when installed) + immutable upload to
 *      `assets/books/<slug>-<sha12>.pdf` with license/source/SHA-256 provenance metadata.
 *
 * Usage:
 *   bun run ingest-open-pdf.ts --url=https://... --slug=ostep --license=CC-BY-4.0 --dry-run
 *   bun run ingest-open-pdf.ts --url=https://... --slug=ostep --license=CC-BY-4.0 --cdr=gs --write-r2
 */

import { spawnSync } from 'node:child_process';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  checkMalwareBazaarHash,
  isBinaryAvailable,
  runClamScan,
  scanPdfBuffer,
  sha256Hex,
} from './lib/security-scanner.js';

export const ALLOWED_REDISTRIBUTION_LICENSES = new Set([
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-3.0',
  'CC-BY-SA-4.0',
  'CC-BY-SA-3.0',
  'MIT',
  'Apache-2.0',
  'GFDL-1.3',
  'Public-Domain',
  'Unlicense',
]);

export type CdrMode = 'auto' | 'gs' | 'qpdf' | 'none';

const MAX_PDF_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MiB
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;
const CDN_PUBLIC_ORIGIN = (process.env['CDN_BASE_URL'] || 'https://cdn.mikeodnis.dev').replace(
  /\/+$/,
  ''
);

export function isPrivateOrReservedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split('.').map((n) => Number.parseInt(n, 10));
    const [a = 0, b = 0] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 169 && b === 254) return true; // Link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80:') ||
      lower.startsWith('::ffff:127.') ||
      lower.startsWith('::ffff:10.') ||
      lower.startsWith('::ffff:169.254.') ||
      lower.startsWith('::ffff:192.168.')
    );
  }
  return true;
}

export function validateIngestArgs(input: {
  readonly url: string;
  readonly slug: string;
  readonly license: string;
}): { readonly parsedUrl: URL; readonly slug: string; readonly license: string } {
  if (!ALLOWED_REDISTRIBUTION_LICENSES.has(input.license)) {
    throw new Error(
      `License ${JSON.stringify(input.license)} is not on the open-redistribution allowlist (${[
        ...ALLOWED_REDISTRIBUTION_LICENSES,
      ].join(', ')})`
    );
  }
  if (!SLUG_RE.test(input.slug)) {
    throw new Error(`Invalid slug ${JSON.stringify(input.slug)}: use lowercase kebab-case [a-z0-9-]`);
  }
  const parsedUrl = new URL(input.url);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`Only https:// source URLs are allowed (got ${parsedUrl.protocol})`);
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.port) {
    throw new Error('Refusing URL with embedded credentials or non-default port');
  }
  if (net.isIP(parsedUrl.hostname)) {
    throw new Error('Refusing literal IP host');
  }
  return { parsedUrl, slug: input.slug, license: input.license };
}

async function assertPublicHost(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.home.arpa')
  ) {
    throw new Error(`Refusing private/internal host: ${hostname}`);
  }
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new Error(`Host did not resolve: ${hostname}`);
  }
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error(`Host ${hostname} resolved to blocked IP ${rec.address}`);
    }
  }
}

async function downloadPdfBounded(url: URL): Promise<Uint8Array> {
  let current = url;
  for (let hop = 0; hop <= 3; hop += 1) {
    await assertPublicHost(current.hostname);
    const res = await fetch(current.href, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'application/pdf',
        'User-Agent': 'mikeodnis-cdn-pdf-ingest/1.0 (+https://cdn.mikeodnis.dev)',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => undefined);
      if (!location) throw new Error(`Redirect (${res.status}) missing Location header`);
      const next = new URL(location, current);
      if (next.protocol !== 'https:') {
        throw new Error(`Refusing downgrade redirect to ${next.protocol}`);
      }
      current = next;
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`Download failed with HTTP ${res.status}`);
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/pdf') && !ct.includes('application/octet-stream')) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`Refusing non-PDF Content-Type: ${ct || '(empty)'}`);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Empty response body');
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PDF_DOWNLOAD_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`PDF exceeds ${MAX_PDF_DOWNLOAD_BYTES} byte limit`);
      }
      chunks.push(value);
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return combined;
  }
  throw new Error('Too many redirects (>3)');
}

/**
 * Runs Content Disarm & Reconstruction (CDR) on an input PDF, outputting a cleanly rebuilt PDF.
 */
export function disarmPdf(
  inputPath: string,
  outputPath: string,
  mode: CdrMode
): { readonly effectiveMode: 'gs' | 'qpdf' | 'none' } {
  const effective: 'gs' | 'qpdf' | 'none' =
    mode === 'auto'
      ? isBinaryAvailable('gs')
        ? 'gs'
        : isBinaryAvailable('qpdf')
          ? 'qpdf'
          : (() => {
              throw new Error(
                'CDR requested (auto) but neither Ghostscript (`gs`) nor `qpdf` is installed'
              );
            })()
      : mode;

  if (effective === 'none') {
    fs.copyFileSync(inputPath, outputPath);
    return { effectiveMode: 'none' };
  }

  if (effective === 'gs') {
    if (!isBinaryAvailable('gs')) {
      throw new Error('Ghostscript (`gs`) is not installed');
    }
    const res = spawnSync(
      'gs',
      [
        '-dSAFER',
        '-dBATCH',
        '-dNOPAUSE',
        '-q',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.7',
        '-dPDFSETTINGS=/ebook',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      { encoding: 'utf8', timeout: 120_000 }
    );
    if (res.status !== 0) {
      throw new Error(`Ghostscript CDR failed: ${(res.stderr || res.stdout || '').trim()}`);
    }
    return { effectiveMode: 'gs' };
  }

  if (!isBinaryAvailable('qpdf')) {
    throw new Error('`qpdf` is not installed');
  }
  const res = spawnSync(
    'qpdf',
    ['--linearize', '--object-streams=generate', inputPath, outputPath],
    { encoding: 'utf8', timeout: 60_000 }
  );
  if (res.status !== 0) {
    throw new Error(`qpdf CDR failed: ${(res.stderr || res.stdout || '').trim()}`);
  }
  return { effectiveMode: 'qpdf' };
}

function getArgValue(prefix: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function requireEnv(name: string, fallbackName?: string): string {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const urlArg = getArgValue('--url=');
  const slugArg = getArgValue('--slug=');
  const licenseArg = getArgValue('--license=');
  const cdrArg = (getArgValue('--cdr=') || 'auto') as CdrMode;
  const writeR2 = args.has('--write-r2') && !args.has('--dry-run');

  if (!urlArg || !slugArg || !licenseArg) {
    console.error(
      'Usage: bun run ingest-open-pdf.ts --url=https://... --slug=<kebab> --license=<CC-BY-4.0> [--cdr=auto|gs|qpdf] [--dry-run] [--write-r2]'
    );
    process.exit(1);
  }
  if (!['auto', 'gs', 'qpdf', 'none'].includes(cdrArg)) {
    throw new Error(`Unsupported --cdr mode: ${cdrArg}`);
  }

  const { parsedUrl, slug, license } = validateIngestArgs({
    url: urlArg,
    slug: slugArg,
    license: licenseArg,
  });

  const rawBytes = await downloadPdfBounded(parsedUrl);
  const preFindings = scanPdfBuffer(rawBytes);
  if (preFindings.length > 0) {
    throw new Error(`Pre-CDR PDF rejected: ${preFindings.join(', ')}`);
  }

  const rawHash = sha256Hex(rawBytes);
  const mb = await checkMalwareBazaarHash(rawHash, {
    authKey: process.env['MALWAREBAZAAR_AUTH_KEY']?.trim(),
  });
  if (mb.malicious) {
    throw new Error(`Source PDF hash flagged by MalwareBazaar: ${mb.signature}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdn-pdf-cdr-'));
  try {
    const rawPath = path.join(tmpDir, 'source.pdf');
    const cleanPath = path.join(tmpDir, 'disarmed.pdf');
    fs.writeFileSync(rawPath, rawBytes);

    const { effectiveMode } = disarmPdf(rawPath, cleanPath, cdrArg);
    const cleanBytes = new Uint8Array(fs.readFileSync(cleanPath));
    const postFindings = scanPdfBuffer(cleanBytes);
    if (postFindings.length > 0) {
      throw new Error(`Post-CDR PDF rejected: ${postFindings.join(', ')}`);
    }

    const clam = runClamScan(cleanPath);
    if (clam.infected) {
      throw new Error(`ClamAV flagged disarmed PDF: ${clam.detail}`);
    }

    const cleanSha256 = sha256Hex(cleanBytes);
    const objectKey = `assets/books/${slug}-${cleanSha256.slice(0, 12)}.pdf`;

    if (writeR2) {
      const accountId = requireEnv('R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID');
      const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
      const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
      const bucket = process.env['R2_BUCKET_NAME']?.trim() || 'cdn';
      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: cleanBytes,
          ContentType: 'application/pdf',
          CacheControl: 'public, max-age=31536000, immutable',
          Metadata: {
            license,
            'source-url': parsedUrl.href,
            'source-sha256': rawHash,
            sha256: cleanSha256,
            'cdr-mode': effectiveMode,
            'scanned-at': new Date().toISOString(),
          },
        })
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          uploaded: writeR2,
          slug,
          license,
          cdrMode: effectiveMode,
          rawBytes: rawBytes.byteLength,
          disarmedBytes: cleanBytes.byteLength,
          sha256: cleanSha256,
          objectKey,
          cdnUrl: `${CDN_PUBLIC_ORIGIN}/${objectKey}`,
          clamavChecked: clam.available,
        },
        null,
        2
      )
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('Open PDF ingest failed:', error);
    process.exit(1);
  });
}
