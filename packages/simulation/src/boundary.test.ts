import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? typescriptFiles(path)
      : entry.isFile() && path.endsWith('.ts')
        ? [path]
        : [];
  });
}

describe('simulation package boundary', () => {
  it('contains no NFL or CFB import paths', () => {
    const packageRoot = resolve(import.meta.dirname, '..');
    const files = [
      ...typescriptFiles(resolve(packageRoot, 'src')),
      resolve(packageRoot, 'verify-guardrail.ts'),
    ];
    const forbidden = ['sport-engine-' + 'nfl', 'sport-engine-' + 'cfb'];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        const importPath = new RegExp(
          `(?:from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)["'\`][^"'\`]*${token}`,
        );
        expect(content, file).not.toMatch(importPath);
      }
    }
  });
});
