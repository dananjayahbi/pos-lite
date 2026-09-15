#!/usr/bin/env node
/**
 * XC-01 CI guard — block raw query-param parsing inside src/app/api.
 *
 * Malformed query params must go through src/lib/api/query-params.ts
 * (parseQueryInt/Number/Date/Bool) so they surface as typed 400s instead of
 * NaN/Invalid Date crashes (BUG-28/32/40/45/51/74/75/81/82/84/89/91).
 * Fails the lint step when a new raw call site appears.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'app', 'api');

// Word-boundary so the shared helpers themselves (parseQueryNumber(...) etc.)
// never match. Scoped to the direct `searchParams` binding named by XC-01;
// the `url.searchParams` sites in returns/sales/shifts are W5-owned debt
// (M14-02/M16/M17-02) — extend this list as those docs migrate them.
const BLOCKLIST = [
  /\bNumber\(\s*searchParams\b/,
  /\bparseInt\(\s*searchParams\b/,
  /\bNumber\.parseInt\(\s*searchParams\b/,
  /\bnew Date\(\s*searchParams\b/,
];

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.ts$/.test(entry)) {
      const lines = readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (BLOCKLIST.some((re) => re.test(line))) {
          offenders.push(`${relative(process.cwd(), p)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

walk(ROOT);

if (offenders.length) {
  console.error(
    '\n[XC-01 guard] Raw query-param parsing found in src/app/api — use ' +
      'src/lib/api/query-params.ts (parseQueryInt/parseQueryNumber/' +
      'parseQueryDate/parseQueryBool) instead:\n',
  );
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}
