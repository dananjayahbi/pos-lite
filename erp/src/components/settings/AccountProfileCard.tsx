'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ShieldCheck, Clock, Tag } from 'lucide-react';
import {
  formatAccountTimestamp,
  resolveAccountDisplayName,
} from '@/lib/services/accountProfile.core';

export interface AccountProfile {
  id: string;
  email: string;
  /** Stored staff full name; null until an owner fills it in. */
  fullName?: string | null;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
  tenantId: string | null;
}

export default function AccountProfileCard({ profile }: { profile: AccountProfile }) {
  // ARGUS #506: prefer the stored staff name; the mailbox alias is a fallback.
  const displayName = resolveAccountDisplayName(profile);

  return (
    <Card className="border border-espresso/10">
      <CardHeader>
        <CardTitle className="font-display text-espresso text-xl">Profile</CardTitle>
        <CardDescription>Your account details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-linen font-display text-lg font-bold text-espresso">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-espresso">{displayName}</p>
            <p className="text-xs text-espresso/50">{profile.role.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Row icon={Mail} label="Email" value={profile.email} />
          <Row icon={ShieldCheck} label="Role" value={profile.role.replace(/_/g, ' ')} />
          <Row icon={Clock} label="Last sign-in" value={formatAccountTimestamp(profile.lastLoginAt)} />
          <Row icon={Tag} label="Member since" value={formatAccountTimestamp(profile.createdAt)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-espresso/40" />
      <div className="min-w-0">
        <p className="text-xs text-espresso/50 uppercase tracking-wide">{label}</p>
        <p className="truncate font-medium text-espresso">{value}</p>
      </div>
    </div>
  );
}
