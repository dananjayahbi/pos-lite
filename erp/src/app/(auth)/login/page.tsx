import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultRouteForRole } from '@/lib/utils/default-route';
import { Suspense } from 'react';
import { LoginFormContent } from './login-form';

/**
 * /login — server wrapper (M01-05, BUG-17): an already-authenticated operator
 * never sees the sign-in form; the session is checked server-side and bounced
 * to the role default (tests/01 1.6). The public middleware path lets this
 * route through untouched, so the guard must live here.
 */
export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.role) {
    redirect(getDefaultRouteForRole(session.user.role));
  }

  return (
    <Suspense fallback={<div className="w-full px-4" />}>
      <LoginFormContent />
    </Suspense>
  );
}
