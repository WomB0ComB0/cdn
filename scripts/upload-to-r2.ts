import fs from 'node:fs';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { resolveContainedPath } from '@resq-systems/security/paths';
import mime from 'mime-types';
import type { AssetManifest } from './generate-asset-manifest.js';
import { scanBufferSecurity } from './lib/security-scanner.js';

function requireEnv(name: string, fallbackName?: string): string {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const ACCOUNT_ID = requireEnv('R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID');
const ACCESS_KEY_ID = requireEnv('R2_ACCESS_KEY_ID');
const SECRET_ACCESS_KEY = requireEnv('R2_SECRET_ACCESS_KEY');
const BUCKET_NAME = requireEnv('R2_BUCKET_NAME');
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

const STATIC_DIR = path.resolve(import.meta.dir, '..', 'static');
const MANIFEST_FILE = path.resolve(import.meta.dir, '..', 'asset-manifest.json');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

async function uploadFile(localPath: string, remotePath: string, contentType: string): Promise<void> {
  const fileContent = fs.readFileSync(localPath);
  const scan = scanBufferSecurity({
    filename: path.basename(localPath),
    contentType,
    bytes: new Uint8Array(fileContent.buffer, fileContent.byteOffset, fileContent.byteLength),
  });
  if (!scan.ok) {
    throw new Error(
      `Refusing to upload ${remotePath}: failed security pre-flight (${scan.findings.join(', ')})`
    );
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: remotePath,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      sha256: scan.sha256,
      'scanned-at': new Date().toISOString(),
    },
  });

  try {
    await r2Client.send(command);
    console.log(`Uploaded: ${remotePath}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to upload ${remotePath}: ${message}`);
    throw error;
  }
}

async function main(): Promise<void> {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8')) as AssetManifest;

  const realStaticDir = fs.realpathSync(STATIC_DIR);
  for (const [original, info] of Object.entries(manifest)) {
    const localPath = resolveContainedPath(STATIC_DIR, original, { allowBaseItself: false });
    if (!localPath) {
      throw new Error(`Refusing manifest entry outside static directory: ${original}`);
    }
    const realLocalPath = fs.realpathSync(localPath);
    if (!resolveContainedPath(realStaticDir, realLocalPath, { allowBaseItself: false })) {
      throw new Error(`Refusing symlink escaping static directory: ${original}`);
    }
    if (!info.hashed || info.hashed.includes('..') || info.hashed.includes('\\') || info.hashed.startsWith('/')) {
      throw new Error(`Refusing unsafe remote manifest key: ${info.hashed}`);
    }
    const remotePath = `assets/${info.hashed}`;
    const detected = mime.lookup(original);
    const contentType = typeof detected === 'string' ? detected : 'application/octet-stream';

    await uploadFile(realLocalPath, remotePath, contentType);
  }

  console.log('\nAll assets uploaded successfully.');
}

main().catch((error: unknown) => {
  console.error('Upload failed:', error);
  process.exit(1);
});
