'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { getSession, signIn } from 'next-auth/react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getDefaultRouteForRole } from '@/lib/utils/default-route';
import { AuthLogo } from '@/components/auth/AuthLogo';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function mapAuthError(error: string | undefined, code?: string): string {
  // next-auth surfaces the thrown error's static `type` as `error` (always
  // "CredentialsSignin" for credential failures) and the configurable `code`
  // separately. authorize() rides the specific rejection token on `code`
  // (see signinError in auth.ts), so it must be checked FIRST - otherwise
  // every rejection collapses into the generic invalid-credentials message.
  const signal = code ?? error;

  if (signal?.includes('TOO_MANY_ATTEMPTS')) {
    return 'Too many login attempts. Please wait about 15 minutes before trying again.';
  }

  if (signal?.includes('ACCOUNT_INACTIVE')) {
    return 'Your account is inactive. Please contact an administrator.';
  }

  if (signal?.includes('TENANT_SUSPENDED')) {
    return 'Your business account is suspended. Please contact support to restore access.';
  }

  if (!error) {
    return 'Unable to sign in. Please try again.';
  }

  if (error.includes('CredentialsSignin')) {
    return 'Invalid email or password. Please try again.';
  }

  return 'Unable to sign in. Please try again.';
}

/**
 * NEW-E (M01-05): only same-origin, root-relative callbackUrls are honored —
 * never an absolute foreign URL (open-redirect guard). The middleware sets
 * ?callbackUrl=<pathname> (path-only), but a hand-crafted query could carry
 * anything, so re-validate.
 */
function safeCallbackUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null; // protocol-relative → external
  if (raw.includes('/api/')) return null; // never bounce a page to an API path
  return raw;
}

export function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [postLoginMessage, setPostLoginMessage] = useState<string | null>(null);
  const [cashierChoiceOpen, setCashierChoiceOpen] = useState(false);
  const [pendingCashierRoute, setPendingCashierRoute] = useState<string | null>(null);
  const [pendingCashierEmail, setPendingCashierEmail] = useState<string | null>(null);

  // BUG-14 (M01-05): DOM-disabled only lands after a React commit, so a
  // second click inside that window re-fires onSubmit. This ref closes the
  // gap synchronously — the guard flips before the first await.
  const submittingRef = useRef(false);

  const sessionExpired = searchParams.get('sessionExpired') === 'true';
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    if (submittingRef.current) {
      return;
    }
    // BUG-14 (M01-05): flip the guard synchronously, before any await. It is
    // reset ONLY on the failure paths below — once sign-in succeeds we are
    // navigating away, so the guard stays set and a late forced click (during
    // the getSession/router.push window) cannot re-fire signIn.
    submittingRef.current = true;

    setFormError(null);
    setPostLoginMessage(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0];
        if (fieldName === 'email' || fieldName === 'password') {
          form.setError(fieldName, { message: issue.message });
        }
      }
      submittingRef.current = false;
      return;
    }

    // BUG-15 (M01-05): signIn can THROW on a hard 500/network surface
    // instead of returning {error}. Without the catch the user gets
    // silence while the form re-enables.
    try {
      const result = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      if (result?.error) {
        setFormError(mapAuthError(result.error, result.code));
        submittingRef.current = false;
        return;
      }
    } catch {
      setFormError(mapAuthError(undefined));
      submittingRef.current = false;
      return;
    }

    const session = await getSession();
    const targetRoute = getDefaultRouteForRole(session?.user.role);

    if (session?.user.role === 'CASHIER' && !callbackUrl) {
      // OBS-1: the "Open POS here / new tab" dialog is an intentional
      // product decision — automation contracts depend on it. Release the
      // guard so the dialog's own buttons (and a retry) remain interactive.
      submittingRef.current = false;
      setPendingCashierRoute(targetRoute);
      setPendingCashierEmail(parsed.data.email);
      setCashierChoiceOpen(true);
      form.reset({ email: parsed.data.email, password: '' });
      return;
    }

    // NEW-E: a bounced session returns to its original target; otherwise
    // the role default. Guard stays set — we are navigating away.
    router.push(callbackUrl ?? targetRoute);
  };

  function handleCashierRouteChoice(mode: 'current-tab' | 'new-tab') {
    const targetRoute = pendingCashierRoute ?? '/pos';

    if (mode === 'current-tab') {
      router.push(targetRoute);
      return;
    }

    const openedWindow = window.open(targetRoute, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      setFormError('Unable to open a new tab. Please allow popups for this site or open the POS in the current tab.');
      return;
    }

    setCashierChoiceOpen(false);
    setPostLoginMessage('POS opened in a new tab. You can keep this tab for another sign-in or close it.');
  }

  return (
    <div className="w-full px-4">
      {sessionExpired ? (
        <div className="mb-4 rounded-md border border-sand bg-sand/40 px-4 py-3 text-sm text-espresso">
          Your session has expired or an administrator has signed you out. Please sign in again.
        </div>
      ) : null}

      {postLoginMessage ? (
        <div className="mb-4 rounded-md border border-sand bg-sand/40 px-4 py-3 text-sm text-espresso">
          {postLoginMessage}
        </div>
      ) : null}

      <Card className="mx-auto w-full max-w-[400px] border-mist bg-linen p-6 shadow-lg md:p-8">
        <div className="mb-6 flex flex-col items-center">
          <AuthLogo />
          <h1 className="font-display text-3xl text-espresso">AyurPOS</h1>
          <p className="mt-1 text-sm text-terracotta">Sign in to your account</p>
        </div>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-espresso" htmlFor="email">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="focus-visible:ring-sand"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="mt-1 text-xs text-danger">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-espresso" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className="focus-visible:ring-sand"
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className="mt-1 text-xs text-danger">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="text-right">
            <Link className="text-sm text-terracotta hover:underline" href="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <Button
            className="w-full bg-espresso text-pearl hover:bg-terracotta"
            disabled={form.formState.isSubmitting}
            type="submit"
          >
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>

          {formError ? (
            <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-sm text-terracotta">
              {formError}
            </div>
          ) : null}
        </form>
      </Card>

      <Dialog open={cashierChoiceOpen} onOpenChange={setCashierChoiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Open POS</DialogTitle>
            <DialogDescription>
              {pendingCashierEmail
                ? `${pendingCashierEmail} is ready to use the POS.`
                : 'Your cashier session is ready.'}{' '}
              Choose whether to open the terminal here or in a separate tab.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCashierRouteChoice('new-tab')}
            >
              Open in new tab
            </Button>
            <Button type="button" onClick={() => handleCashierRouteChoice('current-tab')}>
              Open in this tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
