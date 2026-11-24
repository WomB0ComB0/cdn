#!/usr/bin/env bun
/**
 * Desktop / Terminal uploader for cdn.mikeodnis.dev (via api.mikeodnis.dev/v1/media).
 * Uses @resq-systems/security (assertUploadType, sanitizeFilename, containsBidiControls)
 * for local pre-flight WSTG-BUSL-08/09 type-safety before bytes leave the device.
 *
 * Usage:
 *   bun run scripts/cdn-upload.ts login <email>
 *   bun run scripts/cdn-upload.ts <file...> [--private] [--copy]
 *   bun run scripts/cdn-upload.ts list
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { assertUploadType, type FileTypeName } from '@resq-systems/security/controls';
import { sanitizeFilename } from '@resq-systems/security/paths';
import { containsBidiControls } from '@resq-systems/security/unicode';

const API_ORIGIN = process.env['API_ORIGIN'] || 'https://api.mikeodnis.dev';
const CONFIG_DIR = join(homedir(), '.config', 'mike-cdn');
const SESSION_PATH = join(CONFIG_DIR, 'session.json');
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_SVG_BYTES = 2 * 1024 * 1024;

const RESQ_ALLOWED_TYPES: readonly FileTypeName[] = [
  'png',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'pdf',
  'zip',
  'mp4',
  'svg',
  'text',
];

const SVG_ACTIVE_RE =
  /<\s*(?:script|foreignobject|iframe|object|embed|applet|meta|animate|animatemotion|animatetransform|set|handler)\b|<!\s*entity\b|<!\s*doctype\s+[^>]+\[|\bon[a-z]{2,32}\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*(?:text\/html|image\/svg\+xml)|<\s*use\b[^>]*\b(?:xlink:)?href\s*=\s*["']?\s*(?:https?:|\/\/|data:)|@import\b|expression\s*\(/i;

function decodeNumericEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

interface Session {
  access_token: string;
  refresh_token?: string;
  email?: string;
}

function loadSession(): Session | null {
  if (!existsSync(SESSION_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_PATH, 'utf8')) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), { mode: 0o600 });
  chmodSync(SESSION_PATH, 0o600);
}

function matchesBytes(buf: Uint8Array, offset: number, seq: readonly number[]): boolean {
  if (buf.length < offset + seq.length) return false;
  for (let i = 0; i < seq.length; i++) {
    if (buf[offset + i] !== seq[i]) return false;
  }
  return true;
}

/** Handles media-service extensions beyond @resq-systems/security's core FileTypeName set. */
function matchesExtendedMediaSignature(ext: string, head: Uint8Array): boolean {
  switch (ext) {
    case '.avif': {
      if (!matchesBytes(head, 4, [0x66, 0x74, 0x79, 0x70]) || head.length < 12) return false;
      const brand = String.fromCharCode(head[8] ?? 0, head[9] ?? 0, head[10] ?? 0, head[11] ?? 0);
      return ['avif', 'avis', 'mif1', 'msf1'].includes(brand);
    }
    case '.webm':
      return matchesBytes(head, 0, [0x1a, 0x45, 0xdf, 0xa3]);
    case '.wav':
      return matchesBytes(head, 0, [0x52, 0x49, 0x46, 0x46]) && matchesBytes(head, 8, [0x57, 0x41, 0x56, 0x45]);
    case '.ogg':
      return matchesBytes(head, 0, [0x4f, 0x67, 0x67, 0x53]);
    case '.mp3':
      return (
        matchesBytes(head, 0, [0x49, 0x44, 0x33]) ||
        (head.length >= 2 && head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0 && ((head[1] ?? 0) & 0x06) !== 0)
      );
    case '.woff2':
      return matchesBytes(head, 0, [0x77, 0x4f, 0x46, 0x32]);
    default:
      return false;
  }
}

async function preflightValidateLocalFile(
  filePath: string
): Promise<{ ok: true; safeName: string } | { ok: false; reason: string }> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return { ok: false, reason: `File not found: ${filePath}` };
  }
  if (file.size <= 0) {
    return { ok: false, reason: 'File is empty (0 bytes)' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: `File exceeds 100 MiB limit (${file.size} bytes)` };
  }

  const rawName = basename(filePath);
  if (containsBidiControls(rawName)) {
    return { ok: false, reason: 'Filename contains disallowed Unicode bidirectional controls' };
  }
  const safeName = sanitizeFilename(rawName);
  const ext = extname(safeName).toLowerCase();
  if (!ext) {
    return { ok: false, reason: 'Filename must carry an allowed extension' };
  }

  const headBytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());

  if (['.avif', '.webm', '.wav', '.ogg', '.mp3', '.woff2'].includes(ext)) {
    if (!matchesExtendedMediaSignature(ext, headBytes)) {
      return { ok: false, reason: `Leading bytes do not match ${ext} signature` };
    }
    return { ok: true, safeName };
  }

  const verdict = assertUploadType({
    declaredType: '',
    filename: safeName,
    headBytes,
    allow: RESQ_ALLOWED_TYPES,
  });
  if (!verdict.ok) {
    return { ok: false, reason: `${verdict.reason}: ${verdict.detail}` };
  }

  if (verdict.type === 'svg') {
    if (file.size > MAX_SVG_BYTES) {
      return { ok: false, reason: 'SVG exceeds 2 MiB safety cap' };
    }
    const svgText = await file.text();
    if (SVG_ACTIVE_RE.test(svgText) || SVG_ACTIVE_RE.test(decodeNumericEntities(svgText))) {
      return { ok: false, reason: 'SVG contains disallowed active content (script/event handler/XXE/external use)' };
    }
  }

  return { ok: true, safeName };
}

async function copyToClipboard(text: string): Promise<boolean> {
  const candidates: string[][] = [
    ['wl-copy'],
    ['xclip', '-selection', 'clipboard'],
    ['xsel', '--clipboard', '--input'],
    ['pbcopy'],
  ];
  for (const cmd of candidates) {
    try {
      const proc = Bun.spawn(cmd, { stdin: 'pipe', stdout: 'ignore', stderr: 'ignore' });
      proc.stdin.write(text);
      proc.stdin.end();
      const code = await proc.exited;
      if (code === 0) return true;
    } catch {
      // Try next clipboard utility
    }
  }
  return false;
}

async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const session = loadSession();
  if (!session?.access_token) {
    console.error('Not signed in. Run: bun run scripts/cdn-upload.ts login <email>');
    process.exit(1);
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const res = await fetch(`${API_ORIGIN}${path}`, { ...init, headers });
  if (res.status === 401 && retry && session.refresh_token) {
    const ref = await fetch(`${API_ORIGIN}/v1/core/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (ref.ok) {
      const pair = (await ref.json()) as { access_token: string; refresh_token: string };
      saveSession({ ...session, access_token: pair.access_token, refresh_token: pair.refresh_token });
      return apiFetch(path, init, false);
    }
  }
  return res;
}

async function cmdLogin(email?: string): Promise<void> {
  const resolvedEmail = email || prompt('Email:')?.trim();
  const password = process.env['MIKE_API_PASSWORD'] || prompt('Password:');
  if (!resolvedEmail || !password) {
    console.error('Email and password are required.');
    process.exit(1);
  }
  const res = await fetch(`${API_ORIGIN}/v1/core/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: resolvedEmail, password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    console.error(`Login failed (${res.status}): ${data.error || 'unknown error'}`);
    process.exit(1);
  }
  saveSession({
    access_token: data.access_token,
    ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    email: resolvedEmail,
  });
  console.log(`Signed in as ${resolvedEmail} (session saved to ${SESSION_PATH})`);
}

async function cmdList(): Promise<void> {
  const res = await apiFetch('/v1/media/assets?limit=25&offset=0');
  if (!res.ok) {
    console.error(`Failed to list assets: HTTP ${res.status}`);
    process.exit(1);
  }
  const data = (await res.json()) as {
    assets?: Array<{ filename: string; visibility: string; size: number; url: string }>;
  };
  for (const a of data.assets || []) {
    console.log(`[${a.visibility}] ${a.filename} (${a.size} B) -> ${a.url}`);
  }
}

async function cmdUpload(args: string[]): Promise<void> {
  const isPrivate = args.includes('--private');
  const shouldCopy = args.includes('--copy');
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('Usage: bun run scripts/cdn-upload.ts <file...> [--private] [--copy]');
    process.exit(1);
  }

  const urls: string[] = [];
  for (const filePath of files) {
    const check = await preflightValidateLocalFile(filePath);
    if (!check.ok) {
      console.error(`Blocked (${filePath}): ${check.reason}`);
      process.exit(1);
    }

    const file = Bun.file(filePath);
    const form = new FormData();
    form.append('file', file, check.safeName);
    form.append('visibility', isPrivate ? 'private' : 'public');
    const res = await apiFetch('/v1/media/upload', { method: 'POST', body: form });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !body.url) {
      console.error(`Upload failed for ${filePath} (${res.status}): ${body.error || 'unknown'}`);
      process.exit(1);
    }
    urls.push(body.url);
    console.log(body.url);
  }

  if (shouldCopy && urls.length > 0) {
    const copied = await copyToClipboard(urls.join('\n'));
    if (copied) console.error(`Copied ${urls.length} URL(s) to clipboard.`);
  }
}

const [, , subcmd, ...rest] = process.argv;
if (!subcmd || subcmd === '--help' || subcmd === '-h') {
  console.log(`cdn.mikeodnis.dev CLI Uploader (@resq-systems/security pre-flight enabled)
  bun run scripts/cdn-upload.ts login [email]
  bun run scripts/cdn-upload.ts <file...> [--private] [--copy]
  bun run scripts/cdn-upload.ts list`);
  process.exit(0);
}

if (subcmd === 'login') {
  await cmdLogin(rest[0]);
} else if (subcmd === 'list') {
  await cmdList();
} else {
  await cmdUpload([subcmd, ...rest]);
}
