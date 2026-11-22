/**
 * Build guard: server-only modules and the Prisma runtime must never reach a
 * `'use client'` bundle.
 *
 * `@/generated/prisma/client` (and `@prisma/client`) execute `node:module` at
 * import time. Turbopack refuses to bundle node builtins for the browser, so a
 * single runtime import anywhere in the client graph fails `next build` with:
 *
 *   Code generation for chunk item errored
 *   the chunking context (unknown) does not support external modules
 *     (request: node:module)
 *
 * The other half of the same boundary is `import 'server-only'`, which fails
 * with:
 *
 *   'server-only' cannot be imported from a Client Component module.
 *
 * Both build errors name only the FIRST offending path, which makes the
 * regression expensive to chase (ARGUS build failure: `product.validators.ts`
 * -> `StockAdjustmentForm.tsx`, and `constants/courier.ts` ->
 * `dispatchStatus.core.ts` -> `OrdersPageClient.tsx`). This test walks the
 * client import graph from every `'use client'` entry point and fails on:
 *
 *   - any runtime (non-`import type`) import of the Prisma client module,
 *   - any import of `server-only`, and
 *   - any import of a module that opts out of bundling with `server-only`.
 *
 * Allowed: `import type { UserRole } from '@/generated/prisma/client'`, which
 * TypeScript erases at compile time (see the precedent recorded in
 * docs/QA-round1/.../M32-02-progress-details.md, OBS-59).
 *
 * Shared modules that need enum VALUES in the browser must import
 * `@/generated/prisma/enums`, which is dependency-free and browser-safe.
 * Shared modules that read `process.env` or Node APIs must be split, with the
 * browser-safe half in its own file (see `constants/delivery-status.ts`).
 *
 * `'use server'` modules are skipped: Next replaces them with RPC client
 * references, so their imports never enter the browser bundle.
 *
 * Keep this a fast pure file-scan: no build, no module execution.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** `src/` root, resolved relative to this test file (`src/lib/__tests__/`). */
const SRC_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const SCAN_EXT = /\.(ts|tsx)$/;
const CLIENT_DIRECTIVE = /^\s*(['"])use client\1/;
/** `'use server'` modules are compiled to RPC references inside client bundles. */
const SERVER_DIRECTIVE = /^\s*(['"])use server\1/;
/**
 * Generated Prisma runtime entry points, relative to `src/` (the scan root).
 * `enums.ts` / `browser.ts` are intentionally absent: they are browser-safe by
 * design.
 */
const PRISMA_RUNTIME_ENTRY = /^generated\/prisma\/(?:client|internal\/.+)\.ts$/;
const PRISMA_RUNTIME_PACKAGE = '@prisma/client';
const SERVER_ONLY_SPECIFIER = 'server-only';

const SKIP_DIRS = new Set(['node_modules', 'generated', '.next', '.next-dev']);
const SCAN_TIMEOUT_MS = 30_000;

const IMPORT_PATTERN =
  /^[ \t]*(?:import|export)[ \t]+(type[ \t]+)?(?:[\w$*{}\s,]+?\s+from\s+)?(['"])([^'"]+)\2/gm;

interface RuntimeImport {
  specifier: string;
  line: number;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXT.test(entry.name)) {
      out.push(full);
    }
  }
}

function toPosix(file: string): string {
  return file.replace(/\\/g, '/');
}

function startsWithDirective(content: string, directive: RegExp): boolean {
  // The directive must be the first statement; leading blank lines are fine.
  for (const line of content.split('\n')) {
    if (line.trim() === '') continue;
    return directive.test(line);
  }
  return false;
}

function isClientEntry(content: string): boolean {
  return startsWithDirective(content, CLIENT_DIRECTIVE);
}

function isServerActionModule(content: string): boolean {
  return startsWithDirective(content, SERVER_DIRECTIVE);
}

/**
 * Trims comments so a commented-out import is not read as a real dependency.
 */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

/**
 * True when a specifier list holds only `type`-qualified or `type`-prefixed
 * specifiers, e.g. `import { type A, type B } from '...'`.
 */
function isTypeOnlyNamedImport(statement: string): boolean {
  if (/^\s*(?:import|export)\s+type\b/.test(statement)) return true;
  const braced = statement.match(/\{([^}]*)\}/);
  if (!braced) return false;
  const specifiers = (braced[1] ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return specifiers.length > 0 && specifiers.every((part) => part.startsWith('type '));
}

function runtimeImportsOf(file: string): RuntimeImport[] {
  const content = stripComments(readFileSync(file, 'utf8'));
  const imports: RuntimeImport[] = [];
  IMPORT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_PATTERN.exec(content)) !== null) {
    const statement = match[0].trim();
    // Bare `import './x'` and `export * from './x'` are always runtime.
    if (isTypeOnlyNamedImport(statement)) continue;
    const specifier = match[3] ?? '';
    const line = content.slice(0, match.index).split('\n').length;
    imports.push({ specifier, line });
  }
  return imports;
}

function resolveModule(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    return resolveFile(join(SRC_ROOT, specifier.slice(2)));
  }
  if (specifier.startsWith('.')) {
    return resolveFile(resolve(dirname(fromFile), specifier));
  }
  return null;
}

function resolveFile(candidate: string): string | null {
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    if (existsSync(candidate + ext)) return candidate + ext;
  }
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const index = join(candidate, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return null;
}

function relativeToSrc(file: string): string | null {
  const rel = toPosix(relative(SRC_ROOT, file));
  return rel.startsWith('..') ? null : rel;
}

function prismaRuntimeReason(specifier: string, fromFile: string): string | null {
  if (specifier === PRISMA_RUNTIME_PACKAGE || specifier.startsWith(`${PRISMA_RUNTIME_PACKAGE}/`)) {
    return `imports the Prisma runtime package '${specifier}'`;
  }
  const resolved = resolveModule(fromFile, specifier);
  if (!resolved) return null;
  const rel = relativeToSrc(resolved);
  if (rel && PRISMA_RUNTIME_ENTRY.test(rel)) {
    return `imports '${specifier}' (resolves to src/${rel})`;
  }
  return null;
}

/** True when a module opts out of the client bundle via `import 'server-only'`. */
function isServerOnlyModule(file: string): boolean {
  return runtimeImportsOf(file).some(({ specifier }) => specifier === SERVER_ONLY_SPECIFIER);
}

interface Offender {
  /** 'use client' entry that reaches a server-only dependency. */
  entry: string;
  /** Module holding the offending import. */
  file: string;
  line: number;
  reason: string;
  /** Import chain from the entry to the offending module. */
  chain: string[];
}

function findOffenders(): Offender[] {
  const files: string[] = [];
  walk(SRC_ROOT, files);

  const entries = files.filter((file) => isClientEntry(readFileSync(file, 'utf8')));
  const offenders: Offender[] = [];

  for (const entry of entries) {
    const visited = new Set<string>();
    const queue: Array<{ file: string; chain: string[] }> = [{ file: entry, chain: [] }];

    while (queue.length > 0) {
      const { file, chain } = queue.shift()!;
      if (visited.has(file)) continue;
      visited.add(file);

      for (const { specifier, line } of runtimeImportsOf(file)) {
        const reason = prismaRuntimeReason(specifier, file);
        if (reason) {
          offenders.push({ entry, file, line, reason, chain });
          continue;
        }
        if (specifier === SERVER_ONLY_SPECIFIER || specifier.startsWith(`${SERVER_ONLY_SPECIFIER}/`)) {
          offenders.push({
            entry,
            file,
            line,
            reason: `imports '${specifier}' inside a client bundle`,
            chain,
          });
          continue;
        }
        const next = resolveModule(file, specifier);
        if (!next || next.includes('node_modules') || visited.has(next)) continue;
        const nextContent = readFileSync(next, 'utf8');
        // A server action module is replaced by a client reference, so its
        // own imports never become part of the browser bundle.
        if (isServerActionModule(nextContent)) continue;
        // `import 'server-only'` is the Next.js opt-out; following it would
        // report unrelated server deps instead of the real offending edge.
        if (isServerOnlyModule(next)) {
          const marker = runtimeImportsOf(next).find(
            ({ specifier: item }) => item === SERVER_ONLY_SPECIFIER,
          );
          offenders.push({
            entry,
            file: next,
            line: marker?.line ?? 1,
            reason: `is marked '${SERVER_ONLY_SPECIFIER}' and cannot be imported from a client component`,
            chain: [...chain, file],
          });
          continue;
        }
        queue.push({ file: next, chain: [...chain, file] });
      }
    }
  }

  return offenders;
}

function describeOffender(offender: Offender): string {
  const entry = toPosix(relative(SRC_ROOT, offender.entry));
  const file = toPosix(relative(SRC_ROOT, offender.file));
  const chain = [...offender.chain, offender.file]
    .map((item) => toPosix(relative(SRC_ROOT, item)))
    .join(' -> ');
  return `${entry}: ${file}:${offender.line} ${offender.reason} [${chain}]`;
}

describe('client bundle server boundary', () => {
  it(
    'no Prisma runtime or server-only module is reachable from a use client entry',
    () => {
      const offenders = findOffenders().map(describeOffender);
      expect(offenders).toEqual([]);
    },
    SCAN_TIMEOUT_MS,
  );
});
