/**
 * The generated Prisma client lives in `src/generated/prisma`, so `prisma
 * generate` rewrites files that Next.js watches. In development the client is
 * cached on `globalThis` to survive hot reloads, which means a long-running
 * `next dev` process keeps using the client that was generated when it first
 * loaded - newly generated models are missing until the server is restarted.
 *
 * These helpers give the cache a schema signature so `src/lib/prisma.ts` can
 * notice a regenerated client and build a fresh one instead of throwing
 * "An unexpected error occurred" on the first query against a new model.
 */

/** Stable signature for the generated data model (model names only). */
export function prismaModelSignature(modelNames: readonly string[]): string {
  return [...modelNames].sort().join('|');
}

/**
 * Reuse the cached client only when it was built from the same generated data
 * model. A missing signature (first run) also forces a fresh client.
 */
export function shouldReusePrismaClient(
  cachedSignature: string | undefined,
  currentSignature: string,
): boolean {
  return cachedSignature !== undefined && cachedSignature === currentSignature;
}
