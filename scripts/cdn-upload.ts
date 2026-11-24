#!/usr/bin/env bun
/**
 * Desktop / Terminal uploader for cdn.mikeodnis.dev (via api.mikeodnis.dev/v1/media).
 *
 * Usage:
 *   bun run scripts/cdn-upload.ts login <email>
 *   bun run scripts/cdn-upload.ts <file...> [--private] [--copy]
 *   bun run scripts/cdn-upload.ts list
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const API_ORIGIN = process.env['API_ORIGIN'] || 'https://api.mikeodnis.dev';
const CONFIG_DIR = join(homedir(), '.config', 'mike-cdn');
const SESSION_PATH = join(CONFIG_DIR, 'session.json');

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
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const form = new FormData();
    form.append('file', file, basename(filePath));
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
  console.log(`cdn.mikeodnis.dev CLI Uploader
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
