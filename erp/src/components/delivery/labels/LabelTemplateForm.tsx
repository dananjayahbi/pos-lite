'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LABEL_HEADER_LAYOUTS,
  LABEL_PAGE_SIZES,
  LABEL_PAGE_SIZE_LABELS,
  LABEL_COLOR_SWATCHES,
} from '@/lib/constants/label';
import { cn } from '@/lib/utils';
import type { DeliveryLabelTemplate, LabelHeaderLayout, LabelPageSize } from '@/types/delivery-label';

interface LabelTemplateFormProps {
  template: DeliveryLabelTemplate;
  onChange: (patch: Partial<DeliveryLabelTemplate>) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  isResetting: boolean;
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-mist p-3">
      <div>
        <p className="text-sm font-medium text-espresso">{label}</p>
        {hint && <p className="text-xs text-sand">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 shrink-0 p-0"
          aria-label={label}
        />
        <div className="flex flex-wrap gap-1.5">
          {LABEL_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              title={swatch.name}
              onClick={() => onChange(swatch.value)}
              className={cn(
                'h-6 w-6 rounded-full border transition-transform',
                value.toLowerCase() === swatch.value.toLowerCase()
                  ? 'ring-2 ring-espresso ring-offset-1'
                  : 'border-mist hover:scale-110',
              )}
              style={{ backgroundColor: swatch.value }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LabelTemplateForm({
  template,
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
          <CardTitle className="font-display text-espresso">Branding</CardTitle>
          <CardDescription>
            Leave the brand name or logo blank to use your store branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="label-brand">Brand name</Label>
            <Input
              id="label-brand"
              value={template.brandName}
              onChange={(e) => onChange({ brandName: e.target.value })}
              placeholder="Store branding name"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="label-logo">Logo URL</Label>
            <Input
              id="label-logo"
              type="url"
              value={template.logoUrl ?? ''}
              onChange={(e) => onChange({ logoUrl: e.target.value })}
              placeholder="https://… (leave blank to use store logo)"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField
              label="Accent color"
              value={template.accentColor}
              onChange={(v) => onChange({ accentColor: v })}
            />
            <ColorField
              label="Border color"
              value={template.borderColor}
              onChange={(v) => onChange({ borderColor: v })}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Header layout</Label>
              <Select
                value={template.headerLayout}
                onValueChange={(v) => onChange({ headerLayout: v as LabelHeaderLayout })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select layout" />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_HEADER_LAYOUTS.map((layout) => (
                    <SelectItem key={layout} value={layout}>
                      {layout === 'left' ? 'Brand left' : 'Brand centered'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Page size</Label>
              <Select
                value={template.pageSize}
                onValueChange={(v) => onChange({ pageSize: v as LabelPageSize })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {LABEL_PAGE_SIZE_LABELS[size]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Fields</CardTitle>
          <CardDescription>Choose which details appear on the label.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <ToggleRow
            label="Barcodes"
            hint="Order ref (top-right) and courier waybill (center)"
            checked={template.showBarcodes}
            onCheckedChange={(v) => onChange({ showBarcodes: v })}
          />
          <ToggleRow
            label="Order reference"
            checked={template.showOrderRef}
            onCheckedChange={(v) => onChange({ showOrderRef: v })}
          />
          <ToggleRow
            label="COD amount"
            checked={template.showCod}
            onCheckedChange={(v) => onChange({ showCod: v })}
          />
          <ToggleRow
            label="Item count"
            checked={template.showItemCount}
            onCheckedChange={(v) => onChange({ showItemCount: v })}
          />
          <ToggleRow
            label="Weight"
            checked={template.showWeight}
            onCheckedChange={(v) => onChange({ showWeight: v })}
          />
          <ToggleRow
            label="Origin"
            hint="Origin city shown under the brand"
            checked={template.showOrigin}
            onCheckedChange={(v) => onChange({ showOrigin: v })}
          />
          <ToggleRow
            label="Pickup address"
            checked={template.showPickupAddress}
            onCheckedChange={(v) => onChange({ showPickupAddress: v })}
          />
        </CardContent>
      </Card>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">Footer note</CardTitle>
          <CardDescription>Optional short line at the bottom, e.g. handle-with-care.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={template.footerNote}
            onChange={(e) => onChange({ footerNote: e.target.value })}
            placeholder="e.g. Handle with care"
            maxLength={120}
          />
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
