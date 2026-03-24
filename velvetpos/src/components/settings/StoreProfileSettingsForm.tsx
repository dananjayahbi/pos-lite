'use client';

import { useCallback, useState } from 'react';
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
    } catch {
      toast.error('Network error — could not save store profile');
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
              placeholder="VelvetPOS Colombo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={values.logoUrl}
              onChange={(event) => update('logoUrl', event.target.value)}
              placeholder="https://cdn.example.com/logo.png"
            />
            <p className="text-xs text-sand">Optional. This can be used later in printed or digital brand surfaces.</p>
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
            <p className="text-xs text-sand">Printed at the bottom of sale and return receipts.</p>
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
