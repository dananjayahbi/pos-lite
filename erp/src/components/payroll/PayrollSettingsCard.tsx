'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import type { PayrollSettings } from '@/lib/payroll/payroll-settings';

interface Props {
  initialValues: PayrollSettings;
  onSaved?: () => void;
}

export function PayrollSettingsCard({ initialValues, onSaved }: Props) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.PAYROLL.managePayrollSettings);
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/payroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: PayrollSettings;
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save payroll settings');
        return;
      }
      if (json.data) setValues(json.data);
      toast.success('Payroll settings saved');
      onSaved?.();
    } catch {
      toast.error('Network error — could not save payroll settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-mist">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base text-espresso">
          <Settings2 className="h-4 w-4 text-terracotta" />
          Payroll settings
        </CardTitle>
        <CardDescription>
          Employer registration numbers print on the EPF/ETF returns. Working days drive the
          day rate; 0 uses the Monday–Friday count for the selected month.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="payroll-epf-number">Employer EPF No.</Label>
          <Input
            id="payroll-epf-number"
            value={values.employerEpfNumber}
            onChange={(event) =>
              setValues((previous) => ({ ...previous, employerEpfNumber: event.target.value }))
            }
            maxLength={40}
            disabled={!canManage || saving}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payroll-etf-number">Employer ETF No.</Label>
          <Input
            id="payroll-etf-number"
            value={values.employerEtfNumber}
            onChange={(event) =>
              setValues((previous) => ({ ...previous, employerEtfNumber: event.target.value }))
            }
            maxLength={40}
            disabled={!canManage || saving}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payroll-working-days">Working days / month</Label>
          <Input
            id="payroll-working-days"
            type="number"
            min={0}
            max={31}
            value={values.workingDays}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                workingDays: Number(event.target.value) || 0,
              }))
            }
            disabled={!canManage || saving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payroll-ot-multiplier">OT multiplier</Label>
          <Input
            id="payroll-ot-multiplier"
            type="number"
            step="0.1"
            min={1}
            max={4}
            value={values.overtimeMultiplier}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                overtimeMultiplier: Number(event.target.value) || 1.5,
              }))
            }
            disabled={!canManage || saving}
          />
        </div>
        {canManage && (
          <div className="md:col-span-4">
            <Button
              type="button"
              variant="outline"
              onClick={save}
              disabled={!isDirty || saving}
            >
              {saving ? 'Saving…' : 'Save payroll settings'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
