'use client';

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
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

interface LabelTemplateFormProps {
  template: DeliveryLabelTemplate;
  saved: boolean;
  onChange: (patch: Partial<DeliveryLabelTemplate>) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  isResetting: boolean;
}

/**
 * The waybill layout is fixed, so the only editable details are the sender
 * identity printed in the "From"/"Contact" rows.
 */
export function LabelTemplateForm({
  template,
  saved,
  onChange,
  onSave,
  onReset,
  isSaving,
  isResetting,
}: LabelTemplateFormProps) {
  return (
    <div className="space-y-6">
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Sender details</CardTitle>
          <CardDescription>
            Printed in the Proof of Delivery block. The rest of the design follows the
            TransExpress waybill and is fixed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="label-brand">Sender name (From)</Label>
            <Input
              id="label-brand"
              value={template.brandName}
              onChange={(e) => onChange({ brandName: e.target.value })}
              placeholder="Your business name"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="label-from-contact">Sender contact</Label>
            <Input
              id="label-from-contact"
              value={template.fromContact}
              onChange={(e) => onChange({ fromContact: e.target.value })}
              placeholder="e.g. 076 199 2828"
              maxLength={60}
            />
          </div>

          <p className="rounded-md border border-mist/60 bg-linen/40 px-3 py-2 text-xs text-sand-ink">
            {saved
              ? 'Leave the sender name blank to use your store branding. Two waybills print on each A4 landscape sheet.'
              : 'No saved template yet - your store name and contact number are shown as the sender until you save. Two waybills print on each A4 landscape sheet.'}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save template'}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isResetting}>
          {isResetting ? 'Resetting…' : 'Reset to default'}
        </Button>
      </div>
    </div>
  );
}
