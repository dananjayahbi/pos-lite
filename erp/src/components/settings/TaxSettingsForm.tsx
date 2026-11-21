'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatTaxRate } from '@/lib/constants/product-options';
import { taxRulePreviewRows } from '@/lib/pricing/taxRules.core';

type TaxSettingsValues = {
  vatRate: number;
  ssclRate: number;
};

type Props = {
  initialValues: TaxSettingsValues;
};

export default function TaxSettingsForm({ initialValues }: Props) {
  const [values, setValues] = useState<TaxSettingsValues>(initialValues);
  const [saving, setSaving] = useState(false);

  const update = useCallback(<K extends keyof TaxSettingsValues>(key: K, value: TaxSettingsValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const isDirty = values.vatRate !== initialValues.vatRate || values.ssclRate !== initialValues.ssclRate;
  const isValid = [values.vatRate, values.ssclRate].every((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  const canSave = isDirty && isValid && !saving;

  const previewRules = useMemo(
    () => taxRulePreviewRows({ vatRate: values.vatRate, ssclRate: values.ssclRate }),
    [values.ssclRate, values.vatRate],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/taxes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save tax settings');
        return;
      }

      toast.success('Tax settings saved');
      Object.assign(initialValues, values);
      setValues({ ...values });
    } catch {
      toast.error('Network error - could not save tax settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Tax rates</CardTitle>
          <CardDescription>
            Each product uses exactly one tax rule. VAT and SSCL are alternatives, not added
            together; the matching percentage below is the only tax charged for that rule.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vatRate">Standard VAT (%)</Label>
            <Input
              id="vatRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={values.vatRate}
              onChange={(event) => update('vatRate', Number(event.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssclRate">SSCL (%)</Label>
            <Input
              id="ssclRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={values.ssclRate}
              onChange={(event) => update('ssclRate', Number(event.target.value) || 0)}
            />
          </div>

          <div className="md:col-span-2 rounded-lg border border-mist bg-pearl/50 p-4">
            <p className="text-sm font-medium text-espresso">How product tax rules resolve</p>
            <p className="mt-1 text-xs text-sand-ink">
              One rule per product. Choosing VAT does not also charge SSCL, and choosing SSCL
              does not also charge VAT.
            </p>
            <div className="mt-3 space-y-2 text-sm text-sand-ink">
              {previewRules.map((rule) => (
                <div key={rule.rule} className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <span className="font-mono text-xs text-espresso">{rule.rule}</span>
                  <span>{rule.label} - {formatTaxRate(rule.rate)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="w-full bg-espresso text-white hover:bg-espresso/90"
            >
              {saving ? 'Saving…' : 'Save Tax Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
