'use client';

import { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Wrench } from 'lucide-react';
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

type TestFeedback = {
  status: 'idle' | 'success' | 'error';
  message: string;
  details?: string;
  durationMs?: number;
  checkedAt?: string;
};

const EMPTY_FEEDBACK: TestFeedback = {
  status: 'idle',
  message: 'Run a test after saving to verify connectivity.',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function HardwareSettingsForm({ initialValues }: Props) {
  const [values, setValues] = useState<HardwareValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingDrawer, setTestingDrawer] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<TestFeedback>(EMPTY_FEEDBACK);
  const [drawerFeedback, setDrawerFeedback] = useState<TestFeedback>(EMPTY_FEEDBACK);

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
        data?: { message?: string; details?: string; durationMs?: number };
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        setPrintFeedback({
          status: 'error',
          message: json.error?.message ?? 'Test print failed',
          details: 'Confirm printer power, network reachability, and configured port.',
          checkedAt: new Date().toLocaleString(),
        });
        toast.error(json.error?.message ?? 'Test print failed');
      } else {
        setPrintFeedback({
          status: 'success',
          message: json.data?.message ?? 'Test print sent',
          ...(json.data?.details ? { details: json.data.details } : {}),
          ...(json.data?.durationMs !== undefined ? { durationMs: json.data.durationMs } : {}),
          checkedAt: new Date().toLocaleString(),
        });
        toast.success('Test print sent');
      }
    } catch {
      setPrintFeedback({
        status: 'error',
        message: 'Network error — could not reach printer',
        details: 'Verify the POS host can reach the printer on the configured IP and port.',
        checkedAt: new Date().toLocaleString(),
      });
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
        data?: { message?: string; details?: string; durationMs?: number };
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        setDrawerFeedback({
          status: 'error',
          message: json.error?.message ?? 'Drawer kick failed',
          details: 'Check the drawer cable, printer kick port, and drawer-enabled setting.',
          checkedAt: new Date().toLocaleString(),
        });
        toast.error(json.error?.message ?? 'Drawer kick failed');
      } else {
        setDrawerFeedback({
          status: 'success',
          message: json.data?.message ?? 'Cash drawer kicked',
          ...(json.data?.details ? { details: json.data.details } : {}),
          ...(json.data?.durationMs !== undefined ? { durationMs: json.data.durationMs } : {}),
          checkedAt: new Date().toLocaleString(),
        });
        toast.success('Cash drawer kicked');
      }
    } catch {
      setDrawerFeedback({
        status: 'error',
        message: 'Network error — could not reach drawer',
        details: 'If your drawer is connected through the printer, test the printer first and confirm the kick cable is seated.',
        checkedAt: new Date().toLocaleString(),
      });
      toast.error('Network error — could not reach drawer');
    } finally {
      setTestingDrawer(false);
    }
  }

  function FeedbackCard({
    title,
    feedback,
    isBusy,
  }: {
    title: string;
    feedback: TestFeedback;
    isBusy: boolean;
  }) {
    const Icon = isBusy ? Loader2 : feedback.status === 'success' ? CheckCircle2 : feedback.status === 'error' ? AlertCircle : Wrench;
    const iconClassName = isBusy
      ? 'animate-spin text-terracotta'
      : feedback.status === 'success'
        ? 'text-green-600'
        : feedback.status === 'error'
          ? 'text-red-600'
          : 'text-sand';

    return (
      <div className="rounded-lg border border-mist bg-pearl/40 p-4">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 ${iconClassName}`} />
          <div className="space-y-1">
            <p className="font-medium text-espresso">{title}</p>
            <p className="text-sm text-sand">{isBusy ? 'Running live test…' : feedback.message}</p>
            {feedback.details ? <p className="text-xs text-sand">{feedback.details}</p> : null}
            {feedback.checkedAt ? (
              <p className="text-xs text-sand/80">
                Last checked {feedback.checkedAt}
                {feedback.durationMs ? ` · ${feedback.durationMs} ms` : ''}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
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
          <div className="grid flex-1 gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                disabled={isDirty || testingPrint}
                onClick={handleTestPrint}
              >
                {testingPrint ? 'Printing…' : 'Test Print'}
              </Button>
              <FeedbackCard title="Printer Status" feedback={printFeedback} isBusy={testingPrint} />
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                disabled={isDirty || testingDrawer}
                onClick={handleTestDrawer}
              >
                {testingDrawer ? 'Opening…' : 'Test Drawer'}
              </Button>
              <FeedbackCard title="Drawer Status" feedback={drawerFeedback} isBusy={testingDrawer} />
            </div>
          </div>
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
