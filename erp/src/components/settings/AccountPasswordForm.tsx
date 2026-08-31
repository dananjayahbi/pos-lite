'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function AccountPasswordForm() {
  const router = useRouter();
  const [values, setValues] = useState<PasswordFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (key: keyof PasswordFormState, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    setSuccess(false);
  };

  function validate(): boolean {
    const next: Partial<Record<keyof PasswordFormState, string>> = {};

    if (!values.currentPassword) next.currentPassword = 'Current password is required';

    if (values.newPassword.length < 8) {
      next.newPassword = 'New password must be at least 8 characters';
    }

    if (values.newPassword && values.newPassword === values.currentPassword) {
      next.newPassword = 'New password must be different from the current password';
    }

    if (values.confirmPassword !== values.newPassword) {
      next.confirmPassword = 'Passwords do not match';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/settings/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to update password');
        return;
      }

      toast.success('Password updated. You will be signed out for security.');
      setSuccess(true);
      setValues(EMPTY_FORM);
      // Bump the session so the user re-authenticates after a short delay.
      setTimeout(() => {
        void router.push('/login');
      }, 2000);
    } catch {
      toast.error('Network error — could not update password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-espresso/10">
      <CardHeader>
        <CardTitle className="font-display text-espresso text-xl">Change Password</CardTitle>
        <CardDescription>
          Update your account password. You&apos;ll be signed out and asked to sign back in.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} className="space-y-4 p-6 pt-0">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(e) => update('currentPassword', e.target.value)}
          />
          {errors.currentPassword && (
            <p className="text-xs text-terracotta">{errors.currentPassword}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={(e) => update('newPassword', e.target.value)}
          />
          {errors.newPassword && <p className="text-xs text-terracotta">{errors.newPassword}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-terracotta">{errors.confirmPassword}</p>
          )}
        </div>

        {success && (
          <div className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-espresso">
            Your password has been updated. Signing you out…
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => setValues(EMPTY_FORM)}>
            Clear
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
