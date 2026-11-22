'use client';

import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import AccountProfileCard, { type AccountProfile } from './AccountProfileCard';
import AccountPasswordForm from './AccountPasswordForm';

export default function AccountSettingsClient() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ARGUS #507: a failed load used to be a dead end. The same loader is now
  // callable from a Retry button.
  const loadProfile = useCallback(async (isCancelled?: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/account');
      const json = (await res.json()) as {
        success: boolean;
        data?: AccountProfile;
        error?: { message: string };
      };
      if (isCancelled?.()) return;
      if (!res.ok || !json.success) {
        setProfile(null);
        setError(json.error?.message ?? 'Failed to load account details');
        return;
      }
      setProfile(json.data ?? null);
      if (!json.data) setError('Failed to load account details');
    } catch {
      if (!isCancelled?.()) setError('Failed to load account details');
    } finally {
      if (!isCancelled?.()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadProfile(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-espresso/10 px-4 py-16 text-center"
      >
        <p className="text-espresso/60">{error ?? 'Unable to load account details.'}</p>
        <Button className="mt-4" variant="outline" onClick={() => void loadProfile()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountProfileCard profile={profile} />
      <AccountPasswordForm />
    </div>
  );
}
