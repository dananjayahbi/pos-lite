'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export function AppointmentSettingsForm() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Slot Configuration</CardTitle>
          <CardDescription>Configure default time slot settings for appointment scheduling.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Slot Duration (minutes)</Label>
            <Input type="number" defaultValue={15} min={5} max={120} step={5} className="w-[200px]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Configure automated appointment reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>24-Hour Reminder</Label>
              <p className="text-sm text-espresso/60">Send reminder 24 hours before appointment</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>2-Hour Reminder</Label>
              <p className="text-sm text-espresso/60">Send reminder 2 hours before appointment</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status Transitions</CardTitle>
          <CardDescription>Configure allowed statuses for customers and walk-ins.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Confirm on Booking</Label>
              <p className="text-sm text-espresso/60">Immediately set status to Confirmed</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Confirmation</Label>
              <p className="text-sm text-espresso/60">Show Confirm action instead of auto-confirming</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
