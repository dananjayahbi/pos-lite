import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultRouteForRole } from '@/lib/utils/default-route';
import { hasLoginCredentials, sanitizeLoginQuery } from '@/lib/auth/login-params';
import { Suspense } from 'react';
import { LoginFormContent } from './login-form';

/**
 * /login — server wrapper (M01-05, BUG-17): an already-authenticated operator
 * never sees the sign-in form; the session is checked server-side and bounced
 * to the role default (tests/01 1.6). The public middleware path lets this
 * route through untouched, so the guard must live here.
 *
 * ARGUS #39: a pre-hydration GET can append `?email=…&password=…` to this URL.
 * Strip those parameters before rendering so the credentials leave the address
 * bar/history and are never reflected by the form.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  if (hasLoginCredentials(params)) {
    const cleanQuery = sanitizeLoginQuery(params);
    redirect(cleanQuery ? `/login?${cleanQuery}` : '/login');
  }

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
