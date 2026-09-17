/**
 * XC-04 — CI grep guard: `dangerouslySetInnerHTML` must not appear in the ERP
 * `src/` tree. React escapes interpolated values, so the stored-HTML family is
 * inert in the UI *as long as no component opts out of that escaping*. This
 * test locks that invariant in: any new `dangerouslySetInnerHTML` use fails CI
 * unless it is added to the ALLOWLIST below with a written justification.
 *
 * Keep this a fast pure file-scan (no build, no DOM).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// src/ root, resolved relative to this test file (src/lib/__tests__/...).
const SRC_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Files permitted to use `dangerouslySetInnerHTML`, with justification.
 * Empty as of XC-04 — the audit found zero legitimate uses in `src/`.
 */
const ALLOWLIST: ReadonlySet<string> = new Set<string>([]);

const MARKER = 'dangerouslySetInnerHTML';
const SCAN_EXT = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXT.test(entry)) {
      out.push(full);
    }
  }
}

describe('XC-04 no-raw-innerhtml guard', () => {
  it('finds no dangerouslySetInnerHTML in src/ outside the allowlist', () => {
    const files: string[] = [];
    walk(SRC_ROOT, files);

    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(SRC_ROOT, file).replace(/\\/g, '/');
      // This guard file necessarily mentions the marker itself.
      if (rel === 'lib/__tests__/no-raw-innerhtml.test.ts') continue;
      if (ALLOWLIST.has(rel)) continue;
      const content = readFileSync(file, 'utf8');
      if (content.includes(MARKER)) offenders.push(rel);
    }

    expect(offenders).toEqual([]);
  });
});
