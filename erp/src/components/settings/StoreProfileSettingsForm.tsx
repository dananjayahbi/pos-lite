'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LogoUploadField } from '@/components/shared/LogoUploadField';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { storeProfileRefreshPlan } from '@/lib/settings/storeProfileRefresh.core';

type StoreProfileValues = {
  storeName: string;
  logoUrl: string;
  address: string;
  phoneNumber: string;
  receiptFooter: string;
};

type Props = {
  initialValues: StoreProfileValues;
};

export default function StoreProfileSettingsForm({ initialValues }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<StoreProfileValues>(initialValues);
  const [saving, setSaving] = useState(false);

  const update = useCallback(<K extends keyof StoreProfileValues>(key: K, value: StoreProfileValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const isDirty =
    values.storeName !== initialValues.storeName ||
    values.logoUrl !== initialValues.logoUrl ||
    values.address !== initialValues.address ||
    values.phoneNumber !== initialValues.phoneNumber ||
    values.receiptFooter !== initialValues.receiptFooter;

  const canSave = values.storeName.trim().length >= 2 && !saving && isDirty;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save store profile');
        return;
      }

      toast.success('Store profile saved');
      Object.assign(initialValues, values);
      setValues({ ...values });

      // ARGUS #488: the server layout passes the business name/logo to the
      // sidebar and headers. Refresh it, and any cached payload that embeds
      // branding, so the shell does not keep showing the previous identity.
      const refresh = storeProfileRefreshPlan();
      for (const queryKey of refresh.brandingQueryKeys) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
      if (refresh.refreshShell) router.refresh();
    } catch {
      toast.error('Network error - could not save store profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Store identity</CardTitle>
          <CardDescription>
            Keep the name, receipt footer, and contact details polished so every customer touchpoint feels intentional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="storeName">Store name</Label>
            <Input
              id="storeName"
              value={values.storeName}
              onChange={(event) => update('storeName', event.target.value)}
              placeholder="AyurPOS Colombo"
            />
          </div>

          <div className="space-y-2">
            <Label>Store logo</Label>
            <LogoUploadField
              logoUrl={values.logoUrl || null}
              onChange={(url) => update('logoUrl', url ?? '')}
              uploadUrl="/api/settings/store/logo"
              alt="Store logo"
              hint={
                <>
                  JPEG / PNG / WebP / SVG
                  <br />
                  Max 2 MB · stored in R2
                </>
              }
            />
            <p className="text-xs text-sand-ink">
              Shown in the POS header, receipts and customer touchpoints. Upload replaces the
              current logo; press Save Store Profile to apply it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Store address</Label>
            <Textarea
              id="address"
              value={values.address}
              onChange={(event) => update('address', event.target.value)}
              rows={3}
              placeholder="12 Flower Road, Colombo 07"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone number</Label>
            <Input
              id="phoneNumber"
              value={values.phoneNumber}
              onChange={(event) => update('phoneNumber', event.target.value)}
              placeholder="+94 11 234 5678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiptFooter">Receipt footer</Label>
            <Textarea
              id="receiptFooter"
              value={values.receiptFooter}
              onChange={(event) => update('receiptFooter', event.target.value)}
              rows={4}
              placeholder="Thank you for shopping with us!"
            />
            <p className="text-xs text-sand-ink">Printed at the bottom of sale and return receipts.</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full bg-espresso text-white hover:bg-espresso/90"
          >
            {saving ? 'Saving…' : 'Save Store Profile'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
