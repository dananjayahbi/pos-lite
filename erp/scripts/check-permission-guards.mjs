#!/usr/bin/env node
/**
 * XC-03 CI guard — block ad-hoc role checks in API routes and store pages.
 *
 * Five gate styles coexisted before XC-03: a correct `hasPermission` key, role
 * DENYLISTS (which silently admit any role added later — DISPATCH_STAFF slipped
 * through the webhook page), inline role arrays that drift from
 * `ROLE_PERMISSIONS`, and auth-only surfaces with no check at all.
 *
 * New code must express authorization as a permission KEY:
 *   - API routes → `requirePermissionResponse(user, PERMISSIONS.X.y)`
 *   - store pages → `requirePagePermission(user, PERMISSIONS.X.y)` /
 *                   `denialRouteFor(user)`
 *
 * Two deliberate exceptions are allowed, and must stay narrow:
 *   1. `SUPER_ADMIN` checks — platform role, not part of the tenant permission
 *      registry (see api/audit-logs, superadmin/*). Tested by role, by design.
 *   2. `roles.includes(...)` on a NON-session value (e.g. an assignable-role
 *      validator) — this guard only inspects `session.user.role` / `user.role`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = [
  join(process.cwd(), 'src', 'app', 'api'),
  join(process.cwd(), 'src', 'app', '(store)'),
];

/** Role-denylist/allowlist containers. */
const DECLARATION_BLOCKLIST = [
  /\b(DENIED_ROLES|ALLOWED_ROLES|RESTRICTED_ROLES|FORBIDDEN_ROLES|ALLOWED_ROLES_READ|ALLOWED_ROLES_WRITE)\b/,
  /\bBROADCAST_ALLOWED_ROLES\b/,
];

/**
 * Direct role comparisons against a session user. `!== 'SUPER_ADMIN'` and
 * `=== 'SUPER_ADMIN'` are permitted (see the module note).
 */
const COMPARISON_BLOCKLIST = [
  /\bsession\.user\.role\s*[!=]==?\s*'(?!SUPER_ADMIN')[A-Z_]+'/,
  /\buser\.role\s*[!=]==?\s*'(?!SUPER_ADMIN')[A-Z_]+'/,
];

/** Inline role arrays tested with .includes() on a session user. */
const INLINE_ARRAY_BLOCKLIST = [
  /\[\s*'[A-Z_]+'(?:\s*,\s*'[A-Z_]+')+\s*\]\.includes\(\s*session\.user\.role\b/,
  /\[\s*'[A-Z_]+'(?:\s*,\s*'[A-Z_]+')+\s*\]\.includes\(\s*user\.role\b/,
];

const BLOCKLIST = [...DECLARATION_BLOCKLIST, ...COMPARISON_BLOCKLIST, ...INLINE_ARRAY_BLOCKLIST];

const offenders = [];

/**
 * Lines carrying this marker are skipped. Used for explanatory comments that
 * quote the old pattern while documenting the fix — and for the rare
 * deliberate exception, which must justify itself in the same line.
 */
const WAIVER = 'xc-03-waiver:';

function isComment(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('#')
  );
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(entry)) {
      const lines = readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(WAIVER)) return;
        // A comment cannot authorize anything — only code can. Skipping them
        // keeps the guard honest about the pattern while letting the fix's own
        // rationale be written down next to the code it replaced.
        if (isComment(line)) return;
        if (BLOCKLIST.some((re) => re.test(line))) {
          offenders.push(`${relative(process.cwd(), p)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // A missing root (e.g. a trimmed checkout) is not a failure.
  }
}

if (offenders.length) {
  console.error(
    '\n[XC-03 guard] Ad-hoc role checks found — express authorization as a ' +
      'permission KEY instead:\n' +
      '  API  → requirePermissionResponse(session.user, PERMISSIONS.X.y)\n' +
      '  page → requirePagePermission(session.user, PERMISSIONS.X.y)\n' +
      'Only SUPER_ADMIN may be tested by role (platform role, outside the ' +
      'tenant permission registry). Add the key to PERMISSIONS and let ' +
      'ROLE_PERMISSIONS derive the roles.\n',
  );
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}