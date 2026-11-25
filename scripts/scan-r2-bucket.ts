/**
 * Continuous retroactive security scanner for all live Cloudflare R2 objects (`assets/*`, `private/*`).
 *
 * Checks every object against:
 *   1. Static magic-byte parity, PDF active-content & polyglot scan, SVG XSS/XXE scan, ZIP central-dir scan.
 *   2. Hash-only threat intelligence lookup via MalwareBazaar (abuse.ch) — zero content leakage for `/private/*`.
 *   3. Local ClamAV (`clamscan`) when installed (auto-updated via `freshclam` in CI).
 *   4. Local YARA (`yara`) when installed and `--yara-rules=<path>` is passed.
 *
 * On detection with `--quarantine`, atomically copies the object to `quarantine/<key>` (unservable by
 * `cdn-worker`), deletes the live key, and optionally purges Cloudflare Zone Cache (`--purge-cache`).
 *
 * Usage:
 *   bun run scan-r2-bucket.ts --dry-run
 *   bun run scan-r2-bucket.ts --quarantine --purge-cache --fail-on-findings
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  checkMalwareBazaarHash,
  isBinaryAvailable,
  runClamScan,
  runYaraScan,
  scanBufferSecurity,
} from './lib/security-scanner.js';

interface ScanFinding {
  readonly key: string;
  readonly size: number;
  readonly sha256: string;
  readonly reasons: readonly string[];
  readonly quarantined: boolean;
}

interface ScanReport {
  readonly scannedAt: string;
  readonly bucket: string;
  readonly prefixes: readonly string[];
  readonly totalScanned: number;
  readonly skippedOversized: number;
  readonly clamavAvailable: boolean;
  readonly yaraAvailable: boolean;
  readonly dryRun: boolean;
  readonly quarantinedCount: number;
  readonly purgedUrls: readonly string[];
  readonly findings: readonly ScanFinding[];
}

const MAX_SCAN_OBJECT_BYTES = 50 * 1024 * 1024; // 50 MiB cap per object
const CDN_PUBLIC_ORIGIN = (process.env['CDN_BASE_URL'] || 'https://cdn.mikeodnis.dev').replace(
  /\/+$/,
  ''
);

function requireEnv(name: string, fallbackName?: string): string {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getArgValue(prefix: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function listLiveKeys(
  client: S3Client,
  bucket: string,
  prefixes: readonly string[],
  limit: number
): Promise<Array<{ readonly key: string; readonly size: number }>> {
  const out: Array<{ readonly key: string; readonly size: number }> = [];
  for (const prefix of prefixes) {
    let continuationToken: string | undefined;
    for (;;) {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of page.Contents ?? []) {
        if (!obj.Key || obj.Key.endsWith('/')) continue;
        out.push({ key: obj.Key, size: obj.Size ?? 0 });
        if (limit > 0 && out.length >= limit) return out;
      }
      if (!page.IsTruncated || !page.NextContinuationToken) break;
      continuationToken = page.NextContinuationToken;
    }
  }
  return out;
}

async function quarantineObject(
  client: S3Client,
  bucket: string,
  key: string,
  sha256: string,
  reasons: readonly string[]
): Promise<void> {
  const quarantineKey = `quarantine/${key.replace(/^\/+/, '')}`;
  const encodedSource = `${bucket}/${key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')}`;
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: encodedSource,
      Key: quarantineKey,
      MetadataDirective: 'REPLACE',
      Metadata: {
        'original-key': key,
        sha256,
        'quarantined-at': new Date().toISOString(),
        'quarantine-reason': reasons.join('; ').slice(0, 512),
      },
    })
  );
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function purgeCloudflareUrls(urls: readonly string[]): Promise<readonly string[]> {
  const zoneId = process.env['CLOUDFLARE_ZONE_ID']?.trim();
  const apiToken = process.env['CLOUDFLARE_API_TOKEN']?.trim();
  if (!zoneId || !apiToken || urls.length === 0) return [];

  const purged: string[] = [];
  // Cloudflare purge_cache accepts up to 30 URLs per request.
  for (let i = 0; i < urls.length; i += 30) {
    const chunk = urls.slice(i, i + 30);
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: chunk }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      purged.push(...chunk);
    }
  }
  return purged;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run') || !args.has('--quarantine');
  const shouldQuarantine = args.has('--quarantine') && !args.has('--dry-run');
  const shouldPurge = args.has('--purge-cache') && shouldQuarantine;
  const failOnFindings = args.has('--fail-on-findings');
  const skipHashIntel = args.has('--skip-hash-intel');
  const prefixArg = getArgValue('--prefix=');
  const yaraRulesPath = getArgValue('--yara-rules=');
  const limitRaw = getArgValue('--limit=');
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 0;

  const accountId = requireEnv('R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  const bucket = process.env['R2_BUCKET_NAME']?.trim() || 'cdn';
  const malwareBazaarAuthKey = process.env['MALWAREBAZAAR_AUTH_KEY']?.trim();

  const prefixes = prefixArg ? [prefixArg] : ['assets/', 'private/'];
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const clamavAvailable = isBinaryAvailable('clamscan');
  const yaraAvailable = Boolean(yaraRulesPath && isBinaryAvailable('yara'));
  const objects = await listLiveKeys(client, bucket, prefixes, limit);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdn-r2-scan-'));
  const findings: ScanFinding[] = [];
  const urlsToPurge: string[] = [];
  let totalScanned = 0;
  let skippedOversized = 0;
  let quarantinedCount = 0;

  try {
    for (const obj of objects) {
      if (obj.size > MAX_SCAN_OBJECT_BYTES) {
        skippedOversized += 1;
        continue;
      }

      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: obj.key }));
      const rawBytes = res.Body ? await res.Body.transformToByteArray() : new Uint8Array();
      totalScanned += 1;

      const staticScan = scanBufferSecurity({
        filename: path.posix.basename(obj.key),
        contentType: res.ContentType,
        bytes: rawBytes,
      });
      const reasons = [...staticScan.findings];

      if (!skipHashIntel) {
        const mb = await checkMalwareBazaarHash(staticScan.sha256, {
          authKey: malwareBazaarAuthKey,
        });
        if (mb.malicious) {
          reasons.push(`malwarebazaar:${mb.signature ?? 'hit'}`);
        }
      }

      if (clamavAvailable || yaraAvailable) {
        const tmpFile = path.join(tmpDir, `${staticScan.sha256.slice(0, 16)}.bin`);
        fs.writeFileSync(tmpFile, rawBytes);
        try {
          if (clamavAvailable) {
            const clam = runClamScan(tmpFile);
            if (clam.infected) {
              reasons.push(`clamav:${clam.detail ?? 'infected'}`);
            }
          }
          if (yaraAvailable && yaraRulesPath) {
            const yara = runYaraScan(tmpFile, yaraRulesPath);
            if (yara.matched) {
              reasons.push(`yara:${yara.rules.join(',')}`);
            }
          }
        } finally {
          fs.rmSync(tmpFile, { force: true });
        }
      }

      if (reasons.length > 0) {
        let quarantined = false;
        if (shouldQuarantine) {
          await quarantineObject(client, bucket, obj.key, staticScan.sha256, reasons);
          quarantined = true;
          quarantinedCount += 1;
          if (obj.key.startsWith('assets/')) {
            urlsToPurge.push(`${CDN_PUBLIC_ORIGIN}/${obj.key}`);
          }
        }
        findings.push({
          key: obj.key,
          size: obj.size,
          sha256: staticScan.sha256,
          reasons,
          quarantined,
        });
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const purgedUrls = shouldPurge ? await purgeCloudflareUrls(urlsToPurge) : [];
  const report: ScanReport = {
    scannedAt: new Date().toISOString(),
    bucket,
    prefixes,
    totalScanned,
    skippedOversized,
    clamavAvailable,
    yaraAvailable,
    dryRun,
    quarantinedCount,
    purgedUrls,
    findings,
  };

  console.log(JSON.stringify(report, null, 2));

  const reportOut = getArgValue('--report=');
  if (reportOut) {
    fs.writeFileSync(path.resolve(reportOut), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (failOnFindings && findings.length > 0) {
    process.exit(2);
  }
}

main().catch((error: unknown) => {
  console.error('R2 continuous security scan failed:', error);
  process.exit(1);
});
