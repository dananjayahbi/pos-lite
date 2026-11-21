'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useAppointmentSettings, useTenantReminders, useUpdateAppointmentSettings } from '@/hooks/appointments';
import { ReminderStatusBadge } from '../shared/ReminderStatusBadge';
import {
  APPOINTMENT_SLOT_DURATION_MAX,
  APPOINTMENT_SLOT_DURATION_MIN,
  DEFAULT_APPOINTMENT_SETTINGS,
  type AppointmentSettings,
} from '@/lib/appointments/appointmentSettings.core';

function clampSlotDuration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_APPOINTMENT_SETTINGS.slotDurationMins;
  return Math.min(
    Math.max(Math.round(value), APPOINTMENT_SLOT_DURATION_MIN),
    APPOINTMENT_SLOT_DURATION_MAX,
  );
}

/**
 * ARGUS #124 — these controls used to be static markup. They now load and save
 * the tenant-scoped settings persisted at `Tenant.settings.appointments.settings`
 * and are enforced by slot generation, reminder scheduling and the booking
 * status flow.
 */
export function AppointmentSettingsForm() {
  const { data: settings, isLoading, isError, refetch } = useAppointmentSettings();
  const saveMutation = useUpdateAppointmentSettings();
  const { data: reminderQueue, isLoading: remindersLoading, isError: remindersError } = useTenantReminders(25);

  const [draft, setDraft] = useState<AppointmentSettings>(DEFAULT_APPOINTMENT_SETTINGS);
  const [slotText, setSlotText] = useState(String(DEFAULT_APPOINTMENT_SETTINGS.slotDurationMins));

  useEffect(() => {
    if (!settings) return;
    setDraft(settings);
    setSlotText(String(settings.slotDurationMins));
  }, [settings]);

  const slotValue = clampSlotDuration(Number.parseFloat(slotText));
  const isDirty =
    settings !== undefined &&
    (draft.reminder24hEnabled !== settings.reminder24hEnabled ||
      draft.reminder2hEnabled !== settings.reminder2hEnabled ||
      draft.autoConfirmOnBooking !== settings.autoConfirmOnBooking ||
      draft.requireConfirmation !== settings.requireConfirmation ||
      slotValue !== settings.slotDurationMins);

  const handleSave = () => {
    saveMutation.mutate({ ...draft, slotDurationMins: slotValue });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-espresso/50">
          Loading appointment settings…
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load appointment settings.</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Slot Configuration</CardTitle>
          <CardDescription>Configure default time slot settings for appointment scheduling.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appointment-slot-duration">Default Slot Duration (minutes)</Label>
            <Input
              id="appointment-slot-duration"
              type="number"
              min={APPOINTMENT_SLOT_DURATION_MIN}
              max={APPOINTMENT_SLOT_DURATION_MAX}
              step={5}
              value={slotText}
              onChange={(event) => setSlotText(event.target.value)}
              onBlur={() => setSlotText(String(slotValue))}
              className="w-[200px]"
            />
            <p className="text-sm text-espresso/60">
              Used when a staff day has no explicit slot duration, and as the default for new availability rows.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Configure automated appointment reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="appointment-reminder-24h">24-Hour Reminder</Label>
              <p className="text-sm text-espresso/60">Send reminder 24 hours before appointment</p>
            </div>
            <Switch
              id="appointment-reminder-24h"
              checked={draft.reminder24hEnabled}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, reminder24hEnabled: checked }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="appointment-reminder-2h">2-Hour Reminder</Label>
              <p className="text-sm text-espresso/60">Send reminder 2 hours before appointment</p>
            </div>
            <Switch
              id="appointment-reminder-2h"
              checked={draft.reminder2hEnabled}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, reminder2hEnabled: checked }))}
            />
          </div>
          <p className="text-xs text-espresso/50">
            These switches are the reminder policy: each enabled switch schedules one message at
            that offset for new bookings. Disabled reminders are not scheduled; reminders already
            queued keep their delivery status.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminder Delivery</CardTitle>
          <CardDescription>Status of the reminder queue across all appointments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {remindersLoading ? (
            <p className="text-sm text-espresso/50">Loading reminder queue…</p>
          ) : remindersError ? (
            <p className="text-sm text-red-700">Could not load the reminder queue.</p>
          ) : reminderQueue ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                  {reminderQueue.summary.pending} pending
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">
                  {reminderQueue.summary.sent} sent
                </span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">
                  {reminderQueue.summary.failed} failed
                </span>
              </div>
              {reminderQueue.reminders.length === 0 ? (
                <p className="text-sm text-espresso/50">No reminders scheduled.</p>
              ) : (
                <ul className="max-h-[280px] space-y-1 overflow-auto">
                  {reminderQueue.reminders.map((reminder) => (
                    <li
                      key={reminder.id}
                      className="flex items-start justify-between gap-2 rounded border border-espresso/10 p-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-espresso">
                          {reminder.appointment?.title ?? 'Appointment'} ·{' '}
                          {reminder.channel}
                        </p>
                        <p className="text-espresso/60 text-[11px]">
                          Scheduled{' '}
                          {new Date(reminder.scheduledFor).toLocaleString('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                        {reminder.errorMessage ? (
                          <p className="text-[11px] text-red-700">{reminder.errorMessage}</p>
                        ) : null}
                      </div>
                      <ReminderStatusBadge status={reminder.status} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-espresso/50">
                Showing the first {reminderQueue.reminders.length} reminder
                {reminderQueue.reminders.length === 1 ? '' : 's'} (pending first).
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status Transitions</CardTitle>
          <CardDescription>Configure how new bookings enter the appointment lifecycle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="appointment-auto-confirm">Auto-Confirm on Booking</Label>
              <p className="text-sm text-espresso/60">Create new bookings as Confirmed instead of Scheduled</p>
            </div>
            <Switch
              id="appointment-auto-confirm"
              checked={draft.autoConfirmOnBooking}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, autoConfirmOnBooking: checked }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="appointment-require-confirmation">Require Confirmation</Label>
              <p className="text-sm text-espresso/60">
                Keep new bookings Scheduled until staff confirm. Turning this off also lets a Scheduled booking
                skip straight to check-in or completion.
              </p>
            </div>
            <Switch
              id="appointment-require-confirmation"
              checked={draft.requireConfirmation}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, requireConfirmation: checked }))}
            />
          </div>
          <p className="text-xs text-espresso/50">
            Auto-Confirm takes precedence when both switches are on. Existing bookings are not rewritten.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saveMutation.isPending || !isDirty}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
        </Button>
        {!isDirty ? <span className="text-xs text-espresso/50">All changes saved</span> : null}
      </div>
    </div>
  );
}
