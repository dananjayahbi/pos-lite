'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ShieldCheck, Clock, Tag } from 'lucide-react';

export interface AccountProfile {
  id: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
  tenantId: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AccountProfileCard({ profile }: { profile: AccountProfile }) {
  return (
    <Card className="border border-espresso/10">
      <CardHeader>
        <CardTitle className="font-display text-espresso text-xl">Profile</CardTitle>
        <CardDescription>Your account details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-linen font-display text-lg font-bold text-espresso">
            {profile.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-espresso">{profile.email}</p>
            <p className="text-xs text-espresso/50">{profile.role.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Row icon={Mail} label="Email" value={profile.email} />
          <Row icon={ShieldCheck} label="Role" value={profile.role.replace(/_/g, ' ')} />
          <Row icon={Clock} label="Last sign-in" value={formatDate(profile.lastLoginAt)} />
          <Row icon={Tag} label="Member since" value={formatDate(profile.createdAt)} />
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
