'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { staffDisplayName } from '@/lib/utils/staff-name';

export interface AdjustableClockRecord {
  id: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  durationMinutes: number;
  isOpen: boolean;
}

export interface AttendanceAdjustRow {
  userId: string;
  email: string;
  records: AdjustableClockRecord[];
}

interface AttendanceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AttendanceAdjustRow | null;
  date: string;
  onSaved: () => void;
}

function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

/**
 * Adjust one staff member's clock punches for the selected day.
 *
 * ARGUS #349: a day with no punches can now get a new punch (forgotten
 * clock-in/out) instead of only Leave/Absent. Existing punches stay editable.
 */
export function AttendanceAdjustDialog({
  open,
  onOpenChange,
  row,
  date,
  onSaved,
}: AttendanceAdjustDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && row && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-display">Clock Times</DialogTitle>
              <DialogDescription className="font-body text-sm text-mist-ink">
                {staffDisplayName(row.email)} · {date}
              </DialogDescription>
            </DialogHeader>

            <AddPunchForm
              row={row}
              date={date}
              onSaved={() => {
                onSaved();
                onOpenChange(false);
              }}
            />

            {row.records.length > 0 && (
              <div className="space-y-3">
                <p className="font-body text-xs uppercase tracking-wide text-sand-ink">
                  Recorded punches
                </p>
                {row.records.map((record) => (
                  <ClockRecordEditor
                    key={record.id}
                    record={record}
                    onSaved={() => {
                      onSaved();
                      onOpenChange(false);
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="font-body text-sand-ink hover:text-espresso"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function localYmd(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add a missing punch for the day. A past day requires a clock-out (an open
 * interval would otherwise accrue every hour since); today may stay open.
 */
function AddPunchForm({
  row,
  date,
  onSaved,
}: {
  row: AttendanceAdjustRow;
  date: string;
  onSaved: () => void;
}) {
  const isToday = date === localYmd(new Date());
  const [clockIn, setClockIn] = useState(`${date}T09:00`);
  const [clockOut, setClockOut] = useState(isToday ? '' : `${date}T17:00`);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clockIn) {
      setError('Clock-in time is required');
      return;
    }
    const inDate = new Date(clockIn);
    const outDate = clockOut ? new Date(clockOut) : null;
    if (Number.isNaN(inDate.getTime()) || (outDate && Number.isNaN(outDate.getTime()))) {
      setError('Enter a valid date and time');
      return;
    }
    if (outDate && outDate.getTime() <= inDate.getTime()) {
      setError('Clock-out must be after clock-in');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/store/timeclock/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: row.userId,
          clockedInAt: inDate.toISOString(),
          clockedOutAt: outDate ? outDate.toISOString() : null,
          notes: reason.trim() ? reason.trim() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to add the punch');
      }
      toast.success('Punch added');
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to add the punch');
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-dashed border-mist bg-white p-3"
    >
      <div>
        <p className="font-body text-sm font-medium text-espresso">Add missing punch</p>
        <p className="font-body text-[11px] text-sand-ink">
          Use this when a staff member forgot to clock in or out. Worked hours and OT are
          recalculated from the punches.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`add-clock-in-${row.userId}`} className="font-body text-xs">
            Clock In
          </Label>
          <Input
            id={`add-clock-in-${row.userId}`}
            type="datetime-local"
            value={clockIn}
            onChange={(event) => setClockIn(event.target.value)}
            className="mt-1 border-mist font-mono text-xs"
            disabled={isSubmitting}
            required
          />
        </div>
        <div>
          <Label htmlFor={`add-clock-out-${row.userId}`} className="font-body text-xs">
            Clock Out <span className="font-normal text-sand-ink">(optional today)</span>
          </Label>
          <Input
            id={`add-clock-out-${row.userId}`}
            type="datetime-local"
            value={clockOut}
            onChange={(event) => setClockOut(event.target.value)}
            className="mt-1 border-mist font-mono text-xs"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`add-clock-reason-${row.userId}`} className="font-body text-xs">
          Reason <span className="font-normal text-sand-ink">(audit note, optional)</span>
        </Label>
        <Input
          id={`add-clock-reason-${row.userId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Forgot to clock out"
          maxLength={500}
          className="mt-1 border-mist text-xs"
          disabled={isSubmitting}
        />
      </div>

      {error && <p className="font-body text-xs text-[#9B2226]">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="bg-espresso font-body text-pearl hover:bg-espresso/90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Add punch'
          )}
        </Button>
      </div>
    </form>
  );
}

function ClockRecordEditor({
  record,
  onSaved,
}: {
  record: AdjustableClockRecord;
  onSaved: () => void;
}) {
  const [clockIn, setClockIn] = useState(toDateTimeLocal(record.clockedInAt));
  const [clockOut, setClockOut] = useState(
    record.clockedOutAt ? toDateTimeLocal(record.clockedOutAt) : '',
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clockIn) {
      setError('Clock-in time is required');
      return;
    }
    const inDate = new Date(clockIn);
    const outDate = clockOut ? new Date(clockOut) : null;
    if (Number.isNaN(inDate.getTime()) || (outDate && Number.isNaN(outDate.getTime()))) {
      setError('Enter a valid date and time');
      return;
    }
    if (outDate && outDate.getTime() <= inDate.getTime()) {
      setError('Clock-out must be after clock-in');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/store/timeclock/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockedInAt: inDate.toISOString(),
          clockedOutAt: outDate ? outDate.toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to update clock times');
      }
      toast.success('Clock times updated');
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update clock times');
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="space-y-3 rounded-lg border border-mist bg-linen/30 p-3"
    >
      <div className="flex items-center justify-between">
        <p className="font-body text-sm font-medium text-espresso">
          {record.isOpen ? 'Open punch' : 'Completed punch'}
        </p>
        <span className="font-mono text-xs text-sand-ink">
          {formatMinutes(record.durationMinutes)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`clock-in-${record.id}`} className="font-body text-xs">
            Clock In
          </Label>
          <Input
            id={`clock-in-${record.id}`}
            type="datetime-local"
            value={clockIn}
            onChange={(event) => setClockIn(event.target.value)}
            className="mt-1 border-mist font-mono text-xs"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor={`clock-out-${record.id}`} className="font-body text-xs">
            Clock Out
          </Label>
          <Input
            id={`clock-out-${record.id}`}
            type="datetime-local"
            value={clockOut}
            onChange={(event) => setClockOut(event.target.value)}
            className="mt-1 border-mist font-mono text-xs"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {record.isOpen && (
        <p className="font-body text-[11px] text-sand-ink">
          Clock-out is empty. Set the actual end time to close this punch.
        </p>
      )}
      {error && <p className="font-body text-xs text-[#9B2226]">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="bg-espresso font-body text-pearl hover:bg-espresso/90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Save times'
          )}
        </Button>
      </div>
    </form>
  );
}
