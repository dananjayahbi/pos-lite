import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Clear the Next.js build/dev caches.
 *
 * `.next-dev` is the development dist dir; `.next` is the production build.
 * Removing both guarantees the next `next dev` compiles from source instead of
 * reusing a stale production route manifest, which served 404 for dynamic
 * routes (ARGUS #180).
 */
for (const dir of ['.next-dev', '.next']) {
  rmSync(join(process.cwd(), dir), { recursive: true, force: true });
  console.log(`[dev:clean] removed ${dir}`);
}
