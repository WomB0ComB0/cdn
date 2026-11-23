import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface AssetManifestEntry {
  readonly original: string;
  readonly hashed: string;
  readonly hash: string;
  readonly size: number;
}

export type AssetManifest = Record<string, AssetManifestEntry>;

const STATIC_DIR = path.resolve(import.meta.dir, '..', 'static');

function generateHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function walkDirectory(dir: string, baseDir: string, manifest: AssetManifest): void {
  const entries = fs.readdirSync(dir);
  for (const file of entries) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath, baseDir, manifest);
      continue;
    }

    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    const hash = generateHash(filePath);
    const ext = path.extname(file);
    const name = path.basename(file, ext);
    const dirName = path.dirname(relativePath);
    const hashedFileName = `${name}.${hash}${ext}`;
    const hashedPath = (dirName === '.' ? hashedFileName : path.join(dirName, hashedFileName)).replace(
      /\\/g,
      '/'
    );

    manifest[relativePath] = {
      original: relativePath,
      hashed: hashedPath,
      hash,
      size: stat.size,
    };
  }
}

const manifest: AssetManifest = {};
if (fs.existsSync(STATIC_DIR)) {
  walkDirectory(STATIC_DIR, STATIC_DIR, manifest);
}

console.log(JSON.stringify(manifest, null, 2));
