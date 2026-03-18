'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') {
          form.setError('email', { message: issue.message });
        }
      }
      return;
    }

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
    } finally {
      setSubmitted(true);
    }
  };

  return (
    <div className="w-full px-4">
      <Card className="mx-auto w-full max-w-[420px] border-mist bg-linen p-6 shadow-lg md:p-8">
        <h1 className="font-display text-3xl text-espresso">Reset your password</h1>
        <p className="mt-2 text-sm text-text-muted">
          Enter the email address associated with your account and we will send you a link to reset your
          password.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-md border border-sand bg-sand/30 p-4 text-sm text-espresso">
            If that email address is registered, you will receive a password reset email within a few
            minutes. Please check your spam folder.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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

            <Button
              type="submit"
              className="w-full bg-espresso text-pearl hover:bg-terracotta"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
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
