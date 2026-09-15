/**
 * M01-04 (BUG-12) — client-side sign-out audit helper.
 *
 * NextAuth v5 beta.30's server `events.signOut` fires for JWT strategy, but
 * the event payload only carries the decoded token and the handler runs
 * inside the NextAuth route where request IP/UA context is awkward; the
 * doc's fallback is an explicit best-effort POST from the client BEFORE the
 * cookie is cleared. This helper is the single shared implementation so the
 * sign-out call sites cannot diverge.
 *
 * Best-effort by design: failures are reported to the console (NEW-A:
 * failed audit writes must at least log) but never block the sign-out UX.
 */
export async function postLogoutAudit(): Promise<void> {
  try {
    await fetch('/api/auth/logout-audit', {
      method: 'POST',
      // keepalive so the request survives the imminent navigation.
      keepalive: true,
    });
  } catch (error) {
    console.error('Logout audit POST failed:', error);
  }
}
