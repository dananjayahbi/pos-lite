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
import {
  parseTaxRateInput,
  type TaxRates,
} from '@/lib/settings/taxSettingsChange.core';

type TaxSettingsValues = TaxRates;

type Props = {
  initialValues: TaxSettingsValues;
  /** Version the form loaded; sent back as the optimistic-lock token. */
  version: number;
  /** Effective date of the saved entry, if any. */
  currentEffectiveFrom: string | null;
  /** Server's today (YYYY-MM-DD) so the client does not guess the date. */
  today: string;
  /** Non-null when the saved rates start in the future. */
  pending: (TaxRates & { effectiveFrom: string }) | null;
};

type FormState = {
  vat: string;
  sscl: string;
  effectiveFrom: string;
  acknowledgeZeroRate: boolean;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-LK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function TaxSettingsForm({
  initialValues,
  version,
  currentEffectiveFrom,
  today,
  pending,
}: Props) {
  const [form, setForm] = useState<FormState>({
    vat: String(initialValues.vatRate),
    sscl: String(initialValues.ssclRate),
    effectiveFrom: today,
    acknowledgeZeroRate: false,
  });
  const [saving, setSaving] = useState(false);

  const vat = parseTaxRateInput(form.vat);
  const sscl = parseTaxRateInput(form.sscl);
  const nextRates: TaxRates | null =
    vat.value !== null && sscl.value !== null
      ? { vatRate: vat.value, ssclRate: sscl.value }
      : null;

  const isDirty =
    (nextRates?.vatRate ?? Number.NaN) !== initialValues.vatRate ||
    (nextRates?.ssclRate ?? Number.NaN) !== initialValues.ssclRate ||
    form.effectiveFrom !== (currentEffectiveFrom ?? today) ||
    form.acknowledgeZeroRate;

  // A 0% entry needs an explicit tick: it makes matching products tax-free.
  const zeroesExistingTax =
    nextRates !== null &&
    ((initialValues.vatRate > 0 && nextRates.vatRate === 0) ||
      (initialValues.ssclRate > 0 && nextRates.ssclRate === 0));
  const zeroConfirmed = !zeroesExistingTax || form.acknowledgeZeroRate;

  const canSave =
    isDirty && nextRates !== null && zeroConfirmed && !saving && form.effectiveFrom.length === 10;

  const previewRules = useMemo(
    () =>
      nextRates
        ? taxRulePreviewRows(nextRates)
        : taxRulePreviewRows({ vatRate: 0, ssclRate: 0 }),
    [nextRates],
  );

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  }, []);

  async function handleSave() {
    if (!canSave || !nextRates) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/taxes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nextRates,
          expectedVersion: version,
          effectiveFrom: form.effectiveFrom,
          acknowledgeZeroRate: form.acknowledgeZeroRate,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { code?: string; message: string };
      };

      if (!res.ok || !json.success) {
        if (json.error?.code === 'VERSION_CONFLICT') {
          toast.error(json.error.message);
          return;
        }
        toast.error(json.error?.message ?? 'Failed to save tax settings');
        return;
      }

      toast.success(
        form.effectiveFrom > today
          ? `Tax settings saved - they take effect on ${formatDate(form.effectiveFrom)}`
          : 'Tax settings saved',
      );
      // Give the confirmation a moment to be read, then reload so the new
      // version and the server-resolved active/pending schedule are loaded.
      window.setTimeout(() => window.location.reload(), 900);
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
          {pending && (
            <div className="md:col-span-2 rounded-lg border border-[#1D4E89]/30 bg-linen p-3 text-sm text-espresso">
              <p className="font-medium">Scheduled change</p>
              <p className="mt-1 text-sand-ink">
                {formatTaxRate(pending.vatRate)}% VAT and {formatTaxRate(pending.ssclRate)}% SSCL
                apply from {formatDate(pending.effectiveFrom)}. Until then sales keep the current
                rates.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="vatRate">Standard VAT (%)</Label>
            <Input
              id="vatRate"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              value={form.vat}
              aria-invalid={vat.error !== null}
              aria-describedby="vatRate-error"
              onChange={(event) => update('vat', event.target.value)}
            />
            <p id="vatRate-error" className="text-xs text-[#9B2226]">
              {vat.error}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssclRate">SSCL (%)</Label>
            <Input
              id="ssclRate"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              value={form.sscl}
              aria-invalid={sscl.error !== null}
              aria-describedby="ssclRate-error"
              onChange={(event) => update('sscl', event.target.value)}
            />
            <p id="ssclRate-error" className="text-xs text-[#9B2226]">
              {sscl.error}
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="taxEffectiveFrom">Effective from</Label>
            <Input
              id="taxEffectiveFrom"
              type="date"
              value={form.effectiveFrom}
              min={today}
              onChange={(event) => update('effectiveFrom', event.target.value)}
            />
            <p className="text-xs text-sand-ink">
              Sales recorded on or after this date use the new rates. Earlier sales and reprints
              keep the amounts they were charged.
            </p>
          </div>

          {zeroesExistingTax && (
            <label
              htmlFor="taxZeroRateConfirm"
              className="md:col-span-2 flex items-start gap-3 rounded-lg border border-[#9B2226]/40 bg-linen p-3 text-sm text-espresso"
            >
              <input
                id="taxZeroRateConfirm"
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.acknowledgeZeroRate}
                onChange={(event) => update('acknowledgeZeroRate', event.target.checked)}
              />
              <span>
                <span className="font-medium">Confirm a 0% rate.</span> Products on that tax rule
                will be sold tax-free from the effective date. This is recorded in the audit log.
              </span>
            </label>
          )}

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
            <p className="mt-2 text-center text-xs text-sand-ink">
              Saving records a new version (currently version {version}) and writes an audit entry.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
