'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { QrCode, Info, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  isRenderableQrImageUrl,
  type LankaQrSettings,
} from '@/lib/payments/lanka-qr-config';
import {
  LANKA_QR_IMAGE_ACCEPT,
  lankaQrUploadError,
} from '@/lib/payments/lanka-qr-upload.core';

type Props = {
  initialValues: LankaQrSettings;
};

export default function PaymentSettingsForm({ initialValues }: Props) {
  const [values, setValues] = useState<LankaQrSettings>(initialValues);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    <K extends keyof LankaQrSettings>(key: K, value: LankaQrSettings[K]) => {
      setValues((previous) => ({ ...previous, [key]: value }));
    },
    [],
  );

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  const canSave = isDirty && !saving && !uploading;
  const qrPreview = isRenderableQrImageUrl(values.qrImageUrl);

  async function handleQrUpload(file: File) {
    const rejection = lankaQrUploadError({ type: file.type, size: file.size });
    if (rejection) {
      setUploadError(rejection);
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/settings/payments/qr', {
        method: 'POST',
        body: formData,
      });
      const json = (await res.json()) as { success?: boolean; url?: string; error?: string };
      if (!res.ok || !json.success || !json.url) {
        setUploadError(json.error ?? 'Upload failed. Please try again.');
        return;
      }
      update('qrImageUrl', json.url);
      toast.success('QR image uploaded - press Save Payment Settings to apply it.');
    } catch {
      setUploadError('Network error - could not upload the QR image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: LankaQrSettings;
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save payment settings');
        return;
      }

      const saved = json.data ?? values;
      Object.assign(initialValues, saved);
      setValues(saved);
      toast.success('Payment settings saved');
    } catch {
      toast.error('Network error - could not save payment settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">LankaQR</CardTitle>
          <CardDescription>
            LankaQR is the national merchant-presented QR standard. A static QR issued by your bank
            lets a customer scan, enter the amount and pay from any participating banking app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-mist bg-pearl/50 p-4">
            <div className="space-y-1">
              <Label htmlFor="lankaqr-enabled" className="text-espresso">
                Accept LankaQR payments
              </Label>
              <p className="text-sm text-sand-ink">
                When enabled, LankaQR appears as a tender option at the POS and in back-office sale
                entry.
              </p>
            </div>
            <Switch
              id="lankaqr-enabled"
              checked={values.enabled}
              onCheckedChange={(checked) => update('enabled', checked)}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lankaqr-merchant-name">Merchant name</Label>
              <Input
                id="lankaqr-merchant-name"
                value={values.merchantName}
                onChange={(event) => update('merchantName', event.target.value)}
                placeholder="Trading name shown in the banking app"
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lankaqr-merchant-id">LankaPay merchant ID</Label>
              <Input
                id="lankaqr-merchant-id"
                value={values.merchantId}
                onChange={(event) => update('merchantId', event.target.value)}
                placeholder="MID issued by your bank"
                maxLength={40}
                className="font-mono"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lankaqr-bank-name">Acquiring bank / finance company</Label>
              <Input
                id="lankaqr-bank-name"
                value={values.bankName}
                onChange={(event) => update('bankName', event.target.value)}
                placeholder="e.g. Commercial Bank, Sampath Bank"
                maxLength={80}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lankaqr-image-url">Static QR image</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="lankaqr-image-url"
                  value={values.qrImageUrl}
                  onChange={(event) => update('qrImageUrl', event.target.value)}
                  placeholder="https://cdn.example.com/lankaqr.png or /uploads/lankaqr.png"
                  maxLength={2048}
                  className="font-mono text-xs"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={LANKA_QR_IMAGE_ACCEPT}
                  data-testid="lankaqr-upload-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void handleQrUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading || saving}
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 border-sand text-espresso"
                >
                  <Upload className="mr-1 h-4 w-4" aria-hidden="true" />
                  {uploading ? 'Uploading...' : 'Upload image'}
                </Button>
              </div>
              {uploadError && (
                <p className="text-xs text-[#9B2226]" role="alert">
                  {uploadError}
                </p>
              )}
              <p className="text-xs text-mist-ink">
                Paste the URL of the QR image supplied by your bank, or upload it here (JPEG, PNG
                or WebP, max 2 MB). The cashier sees it in the payment modal - customers scan it
                with their own banking app.
              </p>
            </div>

            <div className="md:col-span-2">
              <div className="flex flex-col gap-4 rounded-lg border border-mist bg-white p-4 sm:flex-row sm:items-center">
                <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md border border-dashed border-mist bg-linen">
                  {qrPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={values.qrImageUrl}
                      alt="LankaQR code preview"
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <QrCode className="h-10 w-10 text-mist-ink" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-1 text-sm text-sand-ink">
                  <p className="font-medium text-espresso">QR preview</p>
                  <p>
                    {qrPreview
                      ? 'This image is shown to the cashier when collecting a LankaQR payment.'
                      : 'Upload the image or paste a valid http(s) / /uploads URL to preview your QR.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lankaqr-instructions">Cashier instructions</Label>
              <Textarea
                id="lankaqr-instructions"
                value={values.instructions}
                onChange={(event) => update('instructions', event.target.value)}
                rows={3}
                maxLength={240}
                placeholder="Ask the customer to scan the QR, enter the amount and confirm."
              />
              <p className="text-right text-xs text-mist-ink">
                {values.instructions.length}/240
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-mist p-4">
              <div className="space-y-1">
                <Label htmlFor="lankaqr-reference-required" className="text-espresso">
                  Require transaction reference
                </Label>
                <p className="text-sm text-sand-ink">
                  The cashier must enter the bank reference before the sale can be confirmed.
                </p>
              </div>
              <Switch
                id="lankaqr-reference-required"
                checked={values.referenceRequired}
                onCheckedChange={(checked) => update('referenceRequired', checked)}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-mist p-4">
              <div className="space-y-1">
                <Label htmlFor="lankaqr-allow-split" className="text-espresso">
                  Allow in split payments
                </Label>
                <p className="text-sm text-sand-ink">
                  Lets the cashier combine LankaQR with a cash leg on one sale.
                </p>
              </div>
              <Switch
                id="lankaqr-allow-split"
                checked={values.allowSplit}
                onCheckedChange={(checked) => update('allowSplit', checked)}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border-l-4 border-[#1D4E89] bg-linen p-3 text-sm text-espresso">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4E89]" aria-hidden="true" />
            <p>
              LankaQR is confirmed manually: the POS records the sale once the cashier has verified
              the payment in the bank app. A dynamic, amount-embedded QR would require a bank API
              integration and is not part of this configuration.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full bg-espresso text-white hover:bg-espresso/90"
          >
            {saving ? 'Saving…' : 'Save Payment Settings'}
          </Button>
          {uploading && (
            <p className="text-center text-xs text-sand-ink">
              Save is disabled until the QR image upload finishes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
