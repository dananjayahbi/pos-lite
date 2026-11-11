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
 * Adjust one staff member's clock punches for the selected day. Open punches
 * (forgotten clock-outs) are the main use case; the clock-out field can be set
 * to the real end time.
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
              <DialogTitle className="font-display">Adjust Clock Times</DialogTitle>
              <DialogDescription className="font-body text-sm text-mist-ink">
                {staffDisplayName(row.email)} · {date}
              </DialogDescription>
            </DialogHeader>

            {row.records.length === 0 ? (
              <p className="font-body text-sm text-sand-ink">
                No clock punches exist for this day. Use Mark Attendance to record Leave or
                Absent instead.
              </p>
            ) : (
              <div className="space-y-3">
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
