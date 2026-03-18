'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { getSession, signIn } from 'next-auth/react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function mapAuthError(error: string | undefined): string {
  if (!error) {
    return 'Unable to sign in. Please try again.';
  }

  if (error.includes('TOO_MANY_ATTEMPTS')) {
    return 'Too many login attempts. Please wait about 15 minutes before trying again.';
  }

  if (error.includes('CredentialsSignin')) {
    return 'Invalid email or password. Please try again.';
  }

  if (error.includes('ACCOUNT_INACTIVE')) {
    return 'Your account is inactive. Please contact an administrator.';
  }

  return 'Unable to sign in. Please try again.';
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const sessionExpired = searchParams.get('sessionExpired') === 'true';

  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0];
        if (fieldName === 'email' || fieldName === 'password') {
          form.setError(fieldName, { message: issue.message });
        }
      }
      return;
    }

    const result = await signIn('credentials', {
      ...parsed.data,
      redirect: false,
    });

    if (result?.error) {
      setFormError(mapAuthError(result.error));
      return;
    }

    const session = await getSession();
    if (session?.user.role === 'SUPER_ADMIN') {
      router.push('/superadmin/dashboard');
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="w-full px-4">
      {sessionExpired ? (
        <div className="mb-4 rounded-md border border-sand bg-sand/40 px-4 py-3 text-sm text-espresso">
          Your session has expired or an administrator has signed you out. Please sign in again.
        </div>
      ) : null}

      <Card className="mx-auto w-full max-w-[400px] border-mist bg-linen p-6 shadow-lg md:p-8">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 h-10 w-10 rounded-md bg-espresso" />
          <h1 className="font-display text-3xl text-espresso">VelvetPOS</h1>
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
    </div>
  );
}
