import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(import.meta.dir, '..');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function extractImportSpecifiers(filePath: string): string[] {
  const src = fs.readFileSync(filePath, 'utf8');
  const matches = [...src.matchAll(/(?:import|export)\s+(?:type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/g)];
  return matches.map((m) => m[1]!);
}

describe('Hexagonal Architecture Boundary Enforcement', () => {
  test('domain layer has zero imports from application, adapters, api, or runtime SDKs', () => {
    const domainFiles = collectTsFiles(path.join(SRC_ROOT, 'domain'));
    expect(domainFiles.length).toBeGreaterThan(0);

    const forbidden = [/\/application\//, /\/adapters\//, /\/api\//, /^node:/, /@cloudflare\//];
    for (const file of domainFiles) {
      for (const spec of extractImportSpecifiers(file)) {
        for (const rule of forbidden) {
          expect(rule.test(spec)).toBe(false);
        }
      }
    }
  });

  test('application layer depends only on domain ports/models (never adapters or api)', () => {
    const appFiles = collectTsFiles(path.join(SRC_ROOT, 'application'));
    expect(appFiles.length).toBeGreaterThan(0);

    const forbidden = [/\/adapters\//, /\/api\//, /^node:/, /@cloudflare\//];
    for (const file of appFiles) {
      for (const spec of extractImportSpecifiers(file)) {
        for (const rule of forbidden) {
          expect(rule.test(spec)).toBe(false);
        }
      }
    }
  });
});
