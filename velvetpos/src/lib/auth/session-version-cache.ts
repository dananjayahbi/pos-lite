interface SessionVersionCacheEntry {
  sessionVersion: number;
  cachedAt: number;
}

const SESSION_VERSION_CACHE_TTL_MS = 5_000;
const sessionVersionCache = new Map<string, SessionVersionCacheEntry>();

export function getCachedSessionVersion(userId: string): number | null {
  const cached = sessionVersionCache.get(userId);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > SESSION_VERSION_CACHE_TTL_MS) {
    sessionVersionCache.delete(userId);
    return null;
  }

  return cached.sessionVersion;
}

export function setCachedSessionVersion(userId: string, sessionVersion: number): void {
  sessionVersionCache.set(userId, {
    sessionVersion,
    cachedAt: Date.now(),
  });
}

export function clearSessionVersionCacheForUser(userId: string): void {
  sessionVersionCache.delete(userId);
}
