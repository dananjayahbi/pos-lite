'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCourierSettings } from '@/hooks/delivery';
import type { CourierEnv } from '@/generated/prisma/client';
import {
  buildCourierSettingsPayload,
  validateCourierActivation,
} from '@/lib/courier/settings.core';

interface CourierAccountData {
  env?: CourierEnv | null;
  email?: string | null;
  // GET returns a redacted mask when a secret is stored (never the secret).
  password?: string | null;
  apiKey?: string | null;
  originDistrictId?: number | null;
  originCityId?: number | null;
  pickupAddress?: string | null;
  isActive?: boolean | null;
}

const ENV_OPTIONS: { value: CourierEnv; label: string }[] = [
  { value: 'STAGING', label: 'Staging (test)' },
  { value: 'PRODUCTION', label: 'Production (live)' },
];

export function CourierSettingsForm() {
  const { data, isLoading, save } = useCourierSettings();
  const account = data as CourierAccountData | undefined;

  const [env, setEnv] = useState<CourierEnv>('STAGING');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [originDistrictId, setOriginDistrictId] = useState('');
  const [originCityId, setOriginCityId] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [syncingLocations, setSyncingLocations] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const hydrated = useRef(false);

  // Hydrate local state once the account loads (never clobber in-progress edits).
  useEffect(() => {
    if (!account || hydrated.current) return;
    hydrated.current = true;
    setEnv(account.env ?? 'STAGING');
    setEmail(account.email ?? '');
    setOriginDistrictId(account.originDistrictId?.toString() ?? '');
    setOriginCityId(account.originCityId?.toString() ?? '');
    setPickupAddress(account.pickupAddress ?? '');
    setIsActive(account.isActive ?? false);
  }, [account]);

  function buildPayload(): Record<string, unknown> {
    // ARGUS #513: always send the clearable fields so an empty email, pickup
    // address or origin actually clears the stored value.
    return buildCourierSettingsPayload({
      env,
      email,
      password,
      apiKey,
      originDistrictId,
      originCityId,
      pickupAddress,
      isActive,
    });
  }

  /** Client-side activation guard; the server re-checks the merged account. */
  function activationIssues() {
    const hasStoredSecret = Boolean(account?.password || account?.apiKey);
    return validateCourierActivation({
      isActive,
      email,
      password: password || (hasStoredSecret ? 'stored' : ''),
      apiKey: apiKey || (hasStoredSecret ? 'stored' : ''),
      originDistrictId: originDistrictId ? Number(originDistrictId) : null,
      originCityId: originCityId ? Number(originCityId) : null,
      pickupAddress,
    });
  }

  async function handleSave() {
    if (isActive) {
      const [issue] = activationIssues();
      if (issue) {
        toast.error(issue.message);
        return;
      }
    }
    save.mutate(buildPayload());
  }

  /**
   * ARGUS #513: sync against the UNSAVED form values. Nothing is persisted
   * except the location cache, so a failed sync cannot leave a bad account
   * active.
   */
  async function handleSyncLocations() {
    if (!email && !apiKey && !account?.email) {
      toast.error('Add an email or API key to your Trans Express account first');
      return;
    }
    setSyncingLocations(true);
    try {
      const res = await fetch('/api/store/delivery/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!json.success) throw new Error(json.error?.message ?? 'Location sync failed');
      toast.success('Locations synced. Save the account to keep these changes.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync locations');
    } finally {
      setSyncingLocations(false);
    }
  }

  /**
   * M24-01: verify credentials before dispatching.
   *
   * ARGUS #513: this is a dry run against the current form values. It does NOT
   * save first, so a failed test never leaves invalid or partial credentials
   * (or an activated account) persisted.
   */
  async function handleTestConnection() {
    if (!email && !apiKey && !account?.email) {
      toast.error('Add an email or API key to your Trans Express account first');
      return;
    }
    setTestingConnection(true);
    try {
      const res = await fetch('/api/store/delivery/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!json.success) throw new Error(json.error?.message ?? 'Connection test failed');
      toast.success('Trans Express connection verified. Save the account to keep these changes.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Courier settings</h1>
        <p className="mt-1 text-sm text-sand-ink">
          Configure the Trans Express account used to dispatch deliveries. In production, paste the
          API key from the Trans Express portal (or use email/password on staging).
        </p>
      </div>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Trans Express account</CardTitle>
          <CardDescription>
            The account is marked active before dispatch uses it. Credentials are stored per store.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-mist p-4">
            <div>
              <Label htmlFor="courier-active">Account active</Label>
              <p className="text-sm text-sand-ink">Enable live dispatch against this courier account.</p>
            </div>
            <Switch
              id="courier-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={env} onValueChange={(v) => setEnv(v as CourierEnv)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {ENV_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courier-email">Email</Label>
              <Input
                id="courier-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="account@example.com"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courier-password">Password</Label>
              <Input
                id="courier-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={account?.email ? '••••••••' : 'For staging login'}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courier-apikey">API key</Label>
              <Input
                id="courier-apikey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={account?.apiKey ? '••••••••' : 'Production bearer token'}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courier-district">Origin district ID</Label>
              <Input
                id="courier-district"
                type="number"
                value={originDistrictId}
                onChange={(e) => setOriginDistrictId(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courier-city">Origin city ID</Label>
              <Input
                id="courier-city"
                type="number"
                value={originCityId}
                onChange={(e) => setOriginCityId(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="courier-address">Pickup address</Label>
              <Input
                id="courier-address"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Your pickup / origin address"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-mist pt-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? 'Testing...' : 'Test connection'}
            </Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save account'}
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncLocations}
              disabled={syncingLocations}
            >
              {syncingLocations ? 'Syncing…' : 'Sync locations now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
