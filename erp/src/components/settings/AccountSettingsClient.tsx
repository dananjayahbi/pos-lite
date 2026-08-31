'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import AccountProfileCard, { type AccountProfile } from './AccountProfileCard';
import AccountPasswordForm from './AccountPasswordForm';

export default function AccountSettingsClient() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch('/api/settings/account');
        const json = (await res.json()) as {
          success: boolean;
          data?: AccountProfile;
          error?: { message: string };
        };
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setError(json.error?.message ?? 'Failed to load account details');
          return;
        }
        setProfile(json.data ?? null);
      } catch {
        if (!cancelled) setError('Failed to load account details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="rounded-lg border border-espresso/10 py-16 text-center">
        <p className="text-espresso/60">{error ?? 'Unable to load account details.'}</p>
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
