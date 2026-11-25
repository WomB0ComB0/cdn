import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

export type DetectedAssetType =
  | 'png'
  | 'jpeg'
  | 'gif'
  | 'webp'
  | 'avif'
  | 'ico'
  | 'pdf'
  | 'mp4'
  | 'webm'
  | 'mp3'
  | 'wav'
  | 'ogg'
  | 'zip'
  | 'woff2'
  | 'svg'
  | 'text'
  | 'unknown';

export interface BufferScanResult {
  readonly ok: boolean;
  readonly sha256: string;
  readonly detectedType: DetectedAssetType;
  readonly findings: readonly string[];
}

export interface ThreatHashResult {
  readonly checked: boolean;
  readonly malicious: boolean;
  readonly provider: string | null;
  readonly signature: string | null;
}

const PDF_ACTIVE_OBJECT_RE =
  /\/(?:JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|RichMedia|XFA|SubmitForm|ImportData|GoToR|GoToE|Rendition|Sound|Movie)\b/;
const PDF_POLYGLOT_RE = /(?:<\s*script\b|<!doctype\s+html\b|<\?php\b)/i;
const SVG_OPENING_RE = /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE\s+svg[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i;
const SVG_ACTIVE_RE =
  /<\s*(?:script|foreignobject|iframe|object|embed|applet|meta|animate|animatemotion|animatetransform|set|handler)\b|<!\s*entity\b|<!\s*doctype\s+[^>]+\[|\bon[a-z]{2,32}\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*(?:text\/html|image\/svg\+xml)|<\s*use\b[^>]*\b(?:xlink:)?href\s*=\s*["']?\s*(?:https?:|\/\/|data:)|@import\b|expression\s*\(/i;
const HTML_PREFIX_RE = /^\s*(?:<!doctype\s+html|<html\b|<script\b|<iframe\b|<\?php\b)/i;

const ZIP_MAX_ENTRIES = 2000;
const ZIP_MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024; // 512 MiB
const ZIP_MAX_RATIO = 100;
const ZIP_DOUBLE_EXT_RE =
  /\.(?:pdf|epub|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|txt|md|csv)\.(?:exe|scr|bat|cmd|vbs|vbe|js|jse|ps1|msi|hta|lnk|jar|apk|sh)$/i;
const ZIP_DANGEROUS_EXTS = new Set([
  '.exe',
  '.dll',
  '.scr',
  '.bat',
  '.cmd',
  '.com',
  '.pif',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.ps1',
  '.psm1',
  '.msi',
  '.msp',
  '.sh',
  '.bash',
  '.zsh',
  '.hta',
  '.lnk',
  '.chm',
  '.jar',
  '.apk',
  '.dmg',
  '.iso',
  '.img',
  '.docm',
  '.xlsm',
  '.pptm',
]);

const EXT_TO_EXPECTED_TYPES: Readonly<Record<string, readonly DetectedAssetType[]>> = {
  '.png': ['png'],
  '.jpg': ['jpeg'],
  '.jpeg': ['jpeg'],
  '.gif': ['gif'],
  '.webp': ['webp'],
  '.avif': ['avif'],
  '.ico': ['ico'],
  '.pdf': ['pdf'],
  '.mp4': ['mp4'],
  '.webm': ['webm'],
  '.mp3': ['mp3'],
  '.wav': ['wav'],
  '.ogg': ['ogg'],
  '.zip': ['zip'],
  '.woff2': ['woff2'],
  '.svg': ['svg'],
  '.txt': ['text'],
  '.csv': ['text'],
  '.json': ['text'],
  '.md': ['text'],
};

const AVIF_BRANDS = new Set(['avif', 'avis', 'mif1', 'msf1']);
const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'mmp4',
  'avc1',
  'dash',
  'M4V ',
  'M4A ',
  'M4P ',
  'M4B ',
  'qt  ',
  '3gp4',
  '3gp5',
  '3g2a',
  'MSNV',
]);

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function startsWithBytes(buf: Uint8Array, prefix: readonly number[]): boolean {
  if (buf.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (buf[i] !== prefix[i]) return false;
  }
  return true;
}

function asciiSlice(buf: Uint8Array, start: number, end: number): string {
  let out = '';
  const limit = Math.min(end, buf.length);
  for (let i = start; i < limit; i += 1) {
    out += String.fromCharCode(buf[i]!);
  }
  return out;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#(\d+);?/g, (_, dec: string) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    })
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

export function detectMagicSignature(bytes: Uint8Array): DetectedAssetType {
  if (bytes.length === 0) return 'unknown';

  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  const head6 = asciiSlice(bytes, 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (bytes.length >= 12 && asciiSlice(bytes, 0, 4) === 'RIFF') {
    const riffType = asciiSlice(bytes, 8, 12);
    if (riffType === 'WEBP') return 'webp';
    if (riffType === 'WAVE') return 'wav';
  }
  if (startsWithBytes(bytes, [0x00, 0x00, 0x01, 0x00])) return 'ico';
  if (asciiSlice(bytes, 0, 5) === '%PDF-') return 'pdf';
  if (asciiSlice(bytes, 0, 4) === 'wOF2') return 'woff2';
  if (startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';
  if (asciiSlice(bytes, 0, 4) === 'OggS') return 'ogg';
  if (
    asciiSlice(bytes, 0, 3) === 'ID3' ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0 && (bytes[1]! & 0x06) !== 0)
  ) {
    return 'mp3';
  }
  if (
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06])
  ) {
    return 'zip';
  }
  if (bytes.length >= 12 && asciiSlice(bytes, 4, 8) === 'ftyp') {
    const brand = asciiSlice(bytes, 8, 12);
    if (AVIF_BRANDS.has(brand)) return 'avif';
    if (MP4_BRANDS.has(brand)) return 'mp4';
    return 'unknown';
  }

  // UTF-8 text / SVG classification on first 512 bytes.
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  for (let i = 0; i < sample.length; i += 1) {
    const b = sample[i]!;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x0c) {
      return 'unknown';
    }
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(sample).replace(/^\uFEFF/, '');
  if (HTML_PREFIX_RE.test(text)) return 'unknown';
  if (SVG_OPENING_RE.test(text)) return 'svg';
  return 'text';
}

function decodePdfHexNames(latin1: string): string {
  return latin1.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

/**
 * Inspects raw PDF bytes (up to 16 MiB window) for active scripting, launch actions,
 * embedded payloads, XFA forms, hex-obfuscated PDF names, and HTML/PHP polyglots.
 */
export function scanPdfBuffer(bytes: Uint8Array): readonly string[] {
  const findings: string[] = [];
  if (asciiSlice(bytes, 0, 5) !== '%PDF-') {
    findings.push('pdf_invalid_magic');
    return findings;
  }

  const scanSlice = bytes.subarray(0, Math.min(bytes.length, 16 * 1024 * 1024));
  const latin1 = Buffer.from(scanSlice.buffer, scanSlice.byteOffset, scanSlice.byteLength).toString(
    'latin1'
  );

  const directMatch = PDF_ACTIVE_OBJECT_RE.exec(latin1);
  if (directMatch) {
    findings.push(`pdf_active_object:${directMatch[0]}`);
  } else {
    const decodedMatch = PDF_ACTIVE_OBJECT_RE.exec(decodePdfHexNames(latin1));
    if (decodedMatch) {
      findings.push(`pdf_obfuscated_active_object:${decodedMatch[0]}`);
    }
  }

  const headWindow = latin1.slice(0, 8192);
  if (PDF_POLYGLOT_RE.test(headWindow)) {
    findings.push('pdf_html_script_polyglot');
  }

  return findings;
}

/**
 * Scans an SVG payload (raw + HTML-entity-decoded) for XSS, XXE, external `<use>`, and SMIL triggers.
 */
export function scanSvgBuffer(bytes: Uint8Array): readonly string[] {
  const findings: string[] = [];
  if (bytes.byteLength > 2 * 1024 * 1024) {
    findings.push('svg_exceeds_2mib');
  }
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (SVG_ACTIVE_RE.test(raw)) {
    findings.push('svg_active_content');
  } else if (SVG_ACTIVE_RE.test(decodeHtmlEntities(raw))) {
    findings.push('svg_entity_encoded_active_content');
  }
  return findings;
}

/**
 * Pure TypeScript ZIP Central Directory inspector (zero extraction, zero external deps).
 * Blocks zip-slip path traversal, embedded executables/scripts, double extensions, and zip bombs.
 */
export function scanZipBuffer(bytes: Uint8Array): readonly string[] {
  const findings: string[] = [];
  if (bytes.byteLength < 22) {
    findings.push('zip_truncated');
    return findings;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Locate End of Central Directory (EOCD) signature 0x06054b50 from tail (max 64 KiB comment + 22B header).
  const minOffset = Math.max(0, bytes.byteLength - 65557);
  let eocdOffset = -1;
  for (let i = bytes.byteLength - 22; i >= minOffset; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    findings.push('zip_missing_eocd');
    return findings;
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (totalEntries > ZIP_MAX_ENTRIES) {
    findings.push(`zip_too_many_entries:${totalEntries}`);
    return findings;
  }
  if (cdOffset + cdSize > bytes.byteLength) {
    findings.push('zip_corrupt_central_directory');
    return findings;
  }

  let cursor = cdOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  const decoder = new TextDecoder('utf-8', { fatal: false });

  for (let idx = 0; idx < totalEntries; idx += 1) {
    if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
      findings.push('zip_corrupt_entry_header');
      break;
    }
    const compSize = view.getUint32(cursor + 20, true);
    const uncompSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > bytes.byteLength) {
      findings.push('zip_corrupt_entry_name');
      break;
    }

    const entryName = decoder.decode(bytes.subarray(nameStart, nameEnd));
    cursor = nameEnd + extraLen + commentLen;

    if (entryName.startsWith('/') || entryName.startsWith('\\') || entryName.includes('\\')) {
      findings.push(`zip_unsafe_path:${entryName.slice(0, 64)}`);
    }
    if (entryName.length >= 2 && entryName[1] === ':') {
      findings.push(`zip_drive_path:${entryName.slice(0, 64)}`);
    }
    if (entryName.split('/').includes('..')) {
      findings.push(`zip_slip_traversal:${entryName.slice(0, 64)}`);
    }
    for (let c = 0; c < entryName.length; c += 1) {
      const code = entryName.charCodeAt(c);
      if (
        code === 0 ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
      ) {
        findings.push('zip_control_or_bidi_name');
        break;
      }
    }

    if (!entryName.endsWith('/')) {
      const base = path.posix.basename(entryName).toLowerCase();
      if (ZIP_DOUBLE_EXT_RE.test(base)) {
        findings.push(`zip_double_extension:${base.slice(0, 64)}`);
      }
      const ext = path.posix.extname(base);
      if (ZIP_DANGEROUS_EXTS.has(ext)) {
        findings.push(`zip_dangerous_entry_ext:${ext}`);
      }
    }

    totalCompressed += compSize;
    totalUncompressed += uncompSize;
    if (totalUncompressed > ZIP_MAX_UNCOMPRESSED_BYTES) {
      findings.push('zip_bomb_uncompressed_limit');
      break;
    }
  }

  if (totalUncompressed > 10 * 1024 * 1024) {
    const floor = Math.max(totalCompressed, bytes.byteLength, 1);
    if (totalUncompressed / floor > ZIP_MAX_RATIO) {
      findings.push('zip_bomb_ratio_exceeded');
    }
  }

  return findings;
}

/**
 * Unified fail-closed static security scan for any buffer destined for or stored in R2.
 */
export function scanBufferSecurity(input: {
  readonly filename: string;
  readonly contentType?: string | null | undefined;
  readonly bytes: Uint8Array;
}): BufferScanResult {
  const findings: string[] = [];
  const sha256 = sha256Hex(input.bytes);
  const detectedType = detectMagicSignature(input.bytes);
  const ext = path.extname(input.filename).toLowerCase();

  if (input.bytes.byteLength === 0) {
    findings.push('empty_file');
  }

  const allowedTypes = EXT_TO_EXPECTED_TYPES[ext];
  if (!allowedTypes) {
    findings.push(`disallowed_extension:${ext || '(none)'}`);
  } else if (!allowedTypes.includes(detectedType)) {
    findings.push(`magic_mismatch:ext=${ext},detected=${detectedType}`);
  }

  if (detectedType === 'pdf') {
    findings.push(...scanPdfBuffer(input.bytes));
  } else if (detectedType === 'svg') {
    findings.push(...scanSvgBuffer(input.bytes));
  } else if (detectedType === 'zip') {
    findings.push(...scanZipBuffer(input.bytes));
  }

  return {
    ok: findings.length === 0,
    sha256,
    detectedType,
    findings,
  };
}

/**
 * Hash-only threat-intelligence check against abuse.ch MalwareBazaar.
 * Sends ONLY the SHA-256 hash — never leaks `/private/*` file contents.
 */
export async function checkMalwareBazaarHash(
  sha256: string,
  options: {
    readonly authKey?: string | undefined;
    readonly timeoutMs?: number | undefined;
    readonly fetcher?: ((input: string | URL | Request, init?: RequestInit) => Promise<Response>) | undefined;
  } = {}
): Promise<ThreatHashResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 4000;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'mikeodnis-cdn-scanner/1.0 (+https://cdn.mikeodnis.dev)',
    };
    if (options.authKey) {
      headers['Auth-Key'] = options.authKey;
    }
    const res = await fetcher('https://mb-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers,
      body: new URLSearchParams({ query: 'get_info', hash: sha256 }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { checked: false, malicious: false, provider: null, signature: null };
    }
    const json = (await res.json()) as {
      readonly query_status?: string;
      readonly data?: readonly { readonly signature?: string | null; readonly file_type?: string }[];
    };
    if (json.query_status === 'ok' && Array.isArray(json.data) && json.data.length > 0) {
      const sig = json.data[0]?.signature ?? 'known_malware_hash';
      return {
        checked: true,
        malicious: true,
        provider: 'MalwareBazaar (abuse.ch)',
        signature: sig,
      };
    }
    return { checked: true, malicious: false, provider: 'MalwareBazaar (abuse.ch)', signature: null };
  } catch {
    return { checked: false, malicious: false, provider: null, signature: null };
  }
}

export function isBinaryAvailable(cmd: string): boolean {
  const res = spawnSync('which', [cmd], { encoding: 'utf8' });
  return res.status === 0;
}

/** Runs local ClamAV (`clamscan --no-summary`) against a temp file when installed. */
export function runClamScan(filePath: string): { readonly available: boolean; readonly infected: boolean; readonly detail: string | null } {
  if (!isBinaryAvailable('clamscan')) {
    return { available: false, infected: false, detail: null };
  }
  const res = spawnSync('clamscan', ['--no-summary', '--infected', filePath], {
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (res.status === 1) {
    return {
      available: true,
      infected: true,
      detail: (res.stdout || res.stderr || 'clamav_hit').trim().slice(0, 200),
    };
  }
  return { available: true, infected: false, detail: null };
}

/** Runs local YARA against a temp file when `yara` and a rules file are available. */
export function runYaraScan(
  filePath: string,
  rulesPath?: string
): { readonly available: boolean; readonly matched: boolean; readonly rules: readonly string[] } {
  if (!rulesPath || !isBinaryAvailable('yara')) {
    return { available: false, matched: false, rules: [] };
  }
  const res = spawnSync('yara', ['-w', rulesPath, filePath], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (res.status === 0 && res.stdout.trim().length > 0) {
    const matchedRules = res.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(/\s+/)[0] ?? '')
      .filter(Boolean);
    return { available: true, matched: matchedRules.length > 0, rules: matchedRules };
  }
  return { available: true, matched: false, rules: [] };
}
