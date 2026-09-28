'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import LogoUploader from '@/components/superadmin/LogoUploader';

const TIMEZONES = [
  'Asia/Colombo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Pacific/Auckland',
];

// The currency is always LKR for this on-premises deployment. It is locked
// here and on the API side so it cannot be changed from the superadmin panel.
const LOCKED_CURRENCY = 'LKR';

type BusinessSettingsValues = {
  storeName: string;
  logoUrl: string;
  address: string;
  phoneNumber: string;
  currency: string;
  timezone: string;
};

type Props = {
  tenantId: string;
  initialValues: BusinessSettingsValues;
};

export default function BusinessSettingsForm({ tenantId, initialValues }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<BusinessSettingsValues>({
    ...initialValues,
    currency: LOCKED_CURRENCY,
  });
  const [saving, setSaving] = useState(false);

  const update = useCallback(
    <K extends keyof BusinessSettingsValues>(key: K, value: BusinessSettingsValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);
  const canSave = values.storeName.trim().length >= 2 && !saving && isDirty;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, currency: LOCKED_CURRENCY }),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save business settings');
        return;
      }

      toast.success('Business settings saved');
      Object.assign(initialValues, values);
      setValues({ ...values });
      router.refresh();
    } catch {
      toast.error('Network error — could not save business settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Business Identity</CardTitle>
          <CardDescription>
            Update the business name, contact details, and branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="storeName">Business Name</Label>
            <Input
              id="storeName"
              value={values.storeName}
              onChange={(e) => update('storeName', e.target.value)}
              placeholder="My Business"
            />
          </div>

          <div className="space-y-2">
            <Label>Business Logo</Label>
            <LogoUploader
              tenantId={tenantId}
              currentUrl={values.logoUrl}
              onUploaded={(url) => update('logoUrl', url)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={values.address}
              onChange={(e) => update('address', e.target.value)}
              rows={3}
              placeholder="12 Main Street, Colombo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={values.phoneNumber}
              onChange={(e) => update('phoneNumber', e.target.value)}
              placeholder="+94 11 234 5678"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Regional Settings</CardTitle>
          <CardDescription>
            Configure the currency and timezone for this business. Tax and
            receipt settings are managed from the business dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="flex h-10 items-center justify-between rounded-md border border-espresso/15 bg-linen/50 px-3 text-sm">
                <span className="font-medium text-espresso">
                  {LOCKED_CURRENCY}
                </span>
                <span className="text-xs text-espresso/50">Locked · LKR</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={values.timezone} onValueChange={(v) => update('timezone', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={!canSave}
        className="w-full bg-espresso text-white hover:bg-espresso/90"
      >
        {saving ? 'Saving…' : 'Save Business Settings'}
      </Button>
    </div>
  );
}
