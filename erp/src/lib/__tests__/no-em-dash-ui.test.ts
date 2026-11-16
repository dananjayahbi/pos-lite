/**
 * Refactor #1 — UI copy must use a plain hyphen, never an em dash.
 *
 * The scan parses every non-test `.ts`/`.tsx` file under `src/` and inspects
 * only string literals, template quasis and JSX text. Comments are ignored, so
 * prose in developer notes may keep an em dash; anything that can reach the
 * screen must not.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const SRC_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EM_DASH = '\u2014';
const SCAN_EXT = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

interface Offender {
  file: string;
  line: number;
  text: string;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Test fixtures/assertions are not UI copy; the runtime UI is.
      if (entry.name === '__tests__') continue;
      walk(full, out);
    } else if (SCAN_EXT.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
}

describe('UI copy: no em dashes', () => {
  it(
    'contains no em dash in string literals, template text or JSX text',
    () => {
      const files: string[] = [];
      walk(SRC_ROOT, files);

      const offenders: Offender[] = [];

      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        if (!text.includes(EM_DASH)) continue;

        const source = ts.createSourceFile(
          file,
          text,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );

        const visit = (node: ts.Node): void => {
          const isCopy =
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node) ||
            ts.isJsxText(node);

          if (isCopy) {
            const start = node.getStart(source);
            const end = node.getEnd();
            const value = text.slice(start, end);
            const index = value.indexOf(EM_DASH);
            if (index !== -1) {
              const position = source.getLineAndCharacterOfPosition(start + index);
              offenders.push({
                file: relative(SRC_ROOT, file).replace(/\\/g, '/'),
                line: position.line + 1,
                text: value.trim().slice(0, 120),
              });
            }
          }

          ts.forEachChild(node, visit);
        };

        visit(source);
      }

      expect(offenders).toEqual([]);
    },
    30_000,
  );
});
