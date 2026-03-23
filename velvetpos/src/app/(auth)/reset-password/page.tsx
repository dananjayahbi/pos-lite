'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="w-full px-4" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [apiError, setApiError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ResetPasswordValues>({
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    if (!token) {
      setApiError('This reset link is invalid.');
      return;
    }

    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0];
        if (fieldName === 'newPassword' || fieldName === 'confirmPassword') {
          form.setError(fieldName, { message: issue.message });
        }
      }
      return;
    }

    setApiError(null);

    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        ...parsed.data,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setApiError(payload?.error ?? 'Unable to reset password.');
      return;
    }

    setIsSuccess(true);
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  };

  if (!token) {
    return (
      <div className="w-full px-4">
        <Card className="mx-auto w-full max-w-[420px] border-mist bg-linen p-6 shadow-lg md:p-8">
          <h1 className="font-display text-2xl text-espresso">This reset link is invalid</h1>
          <p className="mt-3 text-sm text-text-muted">
            Please request a new password reset link and try again.
          </p>
          <Link className="mt-5 inline-block text-sm text-terracotta hover:underline" href="/forgot-password">
            Request a new link
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4">
      <Card className="mx-auto w-full max-w-[420px] border-mist bg-linen p-6 shadow-lg md:p-8">
        <h1 className="font-display text-3xl text-espresso">Set a new password</h1>

        {isSuccess ? (
          <div className="mt-6 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-espresso">
            Your password has been updated. You can now sign in with your new password.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div>
              <label className="mb-1 block text-sm font-medium text-espresso" htmlFor="newPassword">
                New password
              </label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className="focus-visible:ring-sand"
                {...form.register('newPassword')}
              />
              {form.formState.errors.newPassword ? (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.newPassword.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-espresso" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="focus-visible:ring-sand"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword ? (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="w-full bg-espresso text-pearl hover:bg-terracotta"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Updating…' : 'Update password'}
            </Button>

            {apiError ? (
              <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-sm text-terracotta">
                {apiError}
              </div>
            ) : null}
          </form>
        )}

        <div className="mt-5 text-center">
          <Link href="/login" className="text-sm text-terracotta hover:underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
