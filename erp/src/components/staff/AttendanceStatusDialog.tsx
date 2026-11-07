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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { staffDisplayName } from '@/lib/utils/staff-name';

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'HOLIDAY', label: 'Holiday' },
] as const;

export type AttendanceStatusValue = (typeof ATTENDANCE_STATUS_OPTIONS)[number]['value'];

export interface AttendanceStatusRow {
  userId: string;
  email: string;
  status: AttendanceStatusValue;
  attendance: { status: AttendanceStatusValue; notes: string | null } | null;
}

interface AttendanceStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AttendanceStatusRow | null;
  date: string;
  onSaved: () => void;
}

export function AttendanceStatusDialog({
  open,
  onOpenChange,
  row,
  date,
  onSaved,
}: AttendanceStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && row && (
          <StatusForm
            row={row}
            date={date}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onSaved();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusForm({
  row,
  date,
  onCancel,
  onSaved,
}: {
  row: AttendanceStatusRow;
  date: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatusValue>(
    row.attendance?.status ?? row.status,
  );
  const [notes, setNotes] = useState(row.attendance?.notes ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/store/timeclock/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: row.userId,
          date,
          status,
          ...(notes.trim() ? { notes: notes.trim() } : { notes: null }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to save attendance status');
      }
      toast.success('Attendance status updated');
      onSaved();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to save attendance status',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Mark Attendance</DialogTitle>
        <DialogDescription className="font-body text-sm text-mist-ink">
          {staffDisplayName(row.email)} · {date}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="font-body">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatusValue)}>
            <SelectTrigger className="mt-1.5 w-full border-mist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 font-body text-xs text-sand-ink">
            Leave, Absent, Half Day and Holiday override the status derived from clock punches.
          </p>
        </div>

        <div>
          <Label htmlFor="attendance-status-notes" className="font-body">
            Notes <span className="font-normal text-mist-ink">(optional)</span>
          </Label>
          <Input
            id="attendance-status-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Reason or reference"
            maxLength={500}
            className="mt-1.5 border-mist"
            disabled={isSubmitting}
          />
        </div>

        {error && <p className="font-body text-sm text-[#9B2226]">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-espresso font-body text-pearl hover:bg-espresso/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save status'
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
            className="font-body text-sand-ink hover:text-espresso"
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
