import 'server-only';

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';

/**
 * XC-02 — uniform super-admin gate.
 *
 * Policy: missing/invalid session → 401; authenticated-but-forbidden → 403;
 * error bodies use the canonical envelope (`{ success:false, error:{…} }`).
 * Replaces the per-route `role !== 'SUPER_ADMIN' → 403` checks that returned
 * 403 for anonymous callers (OBS-13/OBS-46).
 */
export async function requireSuperAdmin(): Promise<
  { ok: true; session: Session } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      ),
    };
  }
  if (session.user.role !== 'SUPER_ADMIN') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}
