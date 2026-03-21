'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

// ── Types ────────────────────────────────────────────────────────────────────

type PrinterType = 'NETWORK' | 'USB';

type HardwareValues = {
  printerType: PrinterType;
  host: string;
  port: number;
  cashDrawerEnabled: boolean;
  cfdEnabled: boolean;
};

type Props = {
  initialValues: HardwareValues;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function HardwareSettingsForm({ initialValues }: Props) {
  const [values, setValues] = useState<HardwareValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingDrawer, setTestingDrawer] = useState(false);

  const isDirty =
    values.printerType !== initialValues.printerType ||
    values.host !== initialValues.host ||
    values.port !== initialValues.port ||
    values.cashDrawerEnabled !== initialValues.cashDrawerEnabled ||
    values.cfdEnabled !== initialValues.cfdEnabled;

  const isNetworkInvalid =
    values.printerType === 'NETWORK' && values.host.trim() === '';

  const canSave = isDirty && !isNetworkInvalid && !saving;

  const update = useCallback(
    <K extends keyof HardwareValues>(key: K, value: HardwareValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ── Save ────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/hardware', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save settings');
        return;
      }

      toast.success('Hardware settings saved');
      // Reset the "initial" snapshot so isDirty recalculates
      Object.assign(initialValues, values);
      setValues({ ...values });
    } catch {
      toast.error('Network error — could not save settings');
    } finally {
      setSaving(false);
    }
  }

  // ── Test actions ────────────────────────────────────────────────────────

  async function handleTestPrint() {
    setTestingPrint(true);
    try {
      const res = await fetch('/api/hardware/test-print', { method: 'POST' });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Test print failed');
      } else {
        toast.success('Test print sent');
      }
    } catch {
      toast.error('Network error — could not reach printer');
    } finally {
      setTestingPrint(false);
    }
  }

  async function handleTestDrawer() {
    setTestingDrawer(true);
    try {
      const res = await fetch('/api/hardware/test-drawer', { method: 'POST' });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Drawer kick failed');
      } else {
        toast.success('Cash drawer kicked');
      }
    } catch {
      toast.error('Network error — could not reach drawer');
    } finally {
      setTestingDrawer(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Printer & peripherals settings */}
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">
            Printer Settings
          </CardTitle>
          <CardDescription>
            Configure your receipt printer connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Printer Type */}
          <div className="space-y-2">
            <Label htmlFor="printerType">Printer Type</Label>
            <Select
              value={values.printerType}
              onValueChange={(v) => update('printerType', v as PrinterType)}
            >
              <SelectTrigger id="printerType" className="w-full">
                <SelectValue placeholder="Select printer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NETWORK">Network (TCP/IP)</SelectItem>
                <SelectItem value="USB">USB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* IP Address — visible only for NETWORK */}
          <div
            className={
              values.printerType === 'NETWORK'
                ? 'space-y-2'
                : 'hidden'
            }
          >
            <Label htmlFor="host">IP Address</Label>
            <Input
              id="host"
              placeholder="192.168.1.100"
              value={values.host}
              onChange={(e) => update('host', e.target.value)}
            />
          </div>

          {/* Port — visible only for NETWORK */}
          <div
            className={
              values.printerType === 'NETWORK'
                ? 'space-y-2'
                : 'hidden'
            }
          >
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              min={1}
              max={65535}
              value={values.port}
              onChange={(e) => update('port', Number(e.target.value) || 9100)}
            />
          </div>

          {/* Cash Drawer */}
          <div className="flex items-center justify-between rounded-md border border-mist p-4">
            <div className="space-y-0.5">
              <Label htmlFor="cashDrawer" className="text-sm font-medium">
                Enable Cash Drawer
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically kick the cash drawer on cash sales.
              </p>
            </div>
            <Switch
              id="cashDrawer"
              checked={values.cashDrawerEnabled}
              onCheckedChange={(v) => update('cashDrawerEnabled', v)}
            />
          </div>

          {/* Customer Facing Display */}
          <div className="flex items-center justify-between rounded-md border border-mist p-4">
            <div className="space-y-0.5">
              <Label htmlFor="cfd" className="text-sm font-medium">
                Enable Customer Facing Display
              </Label>
              <p className="text-xs text-muted-foreground">
                Show sale totals on a secondary screen during checkout.
              </p>
            </div>
            <Switch
              id="cfd"
              checked={values.cfdEnabled}
              onCheckedChange={(v) => update('cfdEnabled', v)}
            />
          </div>

          {/* Save */}
          <Button
            className="w-full bg-espresso text-white hover:bg-espresso/90"
            disabled={!canSave}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Test Connections */}
      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso">
            Test Connections
          </CardTitle>
          <CardDescription>
            Verify that your printer and cash drawer are reachable.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={isDirty || testingPrint}
            onClick={handleTestPrint}
          >
            {testingPrint ? 'Printing…' : 'Test Print'}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={isDirty || testingDrawer}
            onClick={handleTestDrawer}
          >
            {testingDrawer ? 'Opening…' : 'Test Drawer'}
          </Button>
        </CardContent>
      </Card>

      {/* USB Driver Help */}
      <Card className="border-mist bg-pearl/50">
        <CardHeader>
          <CardTitle className="font-display text-sm text-espresso">
            Setup Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            <span className="font-semibold text-espresso">USB printers:</span>{' '}
            Require <code className="text-terracotta">libusb</code> drivers
            installed on the host machine. On Windows, use Zadig to assign the
            WinUSB driver to your printer.
          </p>
          <p>
            <span className="font-semibold text-espresso">Network printers:</span>{' '}
            Assign a static IP address to your printer to prevent connection
            issues after router restarts.
          </p>
          <p>
            <span className="font-semibold text-espresso">
              Customer Facing Display:
            </span>{' '}
            Connect a secondary monitor and configure your OS to extend (not
            mirror) the display. The POS terminal will automatically detect the
            second screen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
