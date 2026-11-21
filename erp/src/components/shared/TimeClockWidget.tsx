'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';

function formatDuration(startTime: string, endMs: number): string {
  const start = new Date(startTime).getTime();
  const diffMs = Math.max(0, endMs - start);
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Details returned by clock-in when a previous-day punch is still open. */
interface OpenPunchConflict {
  punchId: string;
  clockedInAt: string;
  cappedEndAt?: string;
  maxShiftMinutes: number;
  suggestedCloseAt: string | null;
}

class ClockInConflictError extends Error {
  readonly details: OpenPunchConflict;

  constructor(message: string, details: OpenPunchConflict) {
    super(message);
    this.name = 'ClockInConflictError';
    this.details = details;
  }
}

interface TimeClockWidgetProps {
  /**
   * `compact` is used in the top navigation bar: no status badge, just the
   * elapsed time and the action button.
   */
  variant?: 'default' | 'compact';
}

export function TimeClockWidget({ variant = 'default' }: TimeClockWidgetProps) {
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [conflict, setConflict] = useState<OpenPunchConflict | null>(null);
  const [closeAt, setCloseAt] = useState('');

  const { data: statusData } = useQuery<{
    success: boolean;
    data: {
      clockedInAt: string | null;
      openRecordId: string | null;
      maxShiftMinutes?: number;
      needsReview?: boolean;
    };
  }>({
    queryKey: ['timeclock-me'],
    queryFn: async () => {
      const res = await fetch('/api/store/timeclock/me');
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    enabled: !!sessionData?.user?.id,
    staleTime: 30_000,
  });

  const clockedInAt = statusData?.data?.clockedInAt ?? null;
  const maxShiftMinutes = statusData?.data?.maxShiftMinutes ?? 960;
  const needsReview = statusData?.data?.needsReview ?? false;
  // ARGUS #351: never show an unbounded timer  -  the display stops at the cap.
  const cappedNowMs = clockedInAt
    ? Math.min(nowMs, new Date(clockedInAt).getTime() + maxShiftMinutes * 60_000)
    : nowMs;
  const elapsed = clockedInAt ? formatDuration(clockedInAt, cappedNowMs) : '00:00';

  useEffect(() => {
    if (!clockedInAt) return;
    const interval = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [clockedInAt]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['timeclock-me'] });
    queryClient.invalidateQueries({ queryKey: ['timeclock'] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['staff-detail', sessionData?.user?.id] });
  };

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/timeclock/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const error = json?.error;
        if (
          error?.code === 'OPEN_PUNCH_FROM_PREVIOUS_DAY' &&
          error?.details?.punchId
        ) {
          throw new ClockInConflictError(
            error.message ?? 'A previous clock-in is still open',
            error.details as OpenPunchConflict,
          );
        }
        throw new Error(error?.message ?? 'Clock in failed');
      }
      return json;
    },
    onSuccess: () => {
      toast.success('Clocked in successfully');
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ClockInConflictError) {
        setConflict(err.details);
        setCloseAt(
          toDateTimeLocal(err.details.suggestedCloseAt ?? new Date().toISOString()),
        );
        return;
      }
      toast.error(err.message);
    },
  });

  const closeAndClockInMutation = useMutation({
    mutationFn: async ({ close }: { close: string }) => {
      // Single atomic request: the service closes the previous punch (audited)
      // and starts the new shift. No manageAttendance permission is needed for
      // one's own clock-in.
      const res = await fetch('/api/store/timeclock/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closePreviousPunchAt: new Date(close).toISOString() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Clock in failed');
      }
      return json;
    },
    onSuccess: () => {
      toast.success('Previous punch closed and clocked in');
      setConflict(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/timeclock/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Clock out failed');
      }
      return json;
    },
    onSuccess: () => {
      toast.success('Clocked out successfully');
      invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const conflictDialog = (
    <Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Close previous clock-in</DialogTitle>
          <DialogDescription>
            {conflict
              ? `You are still clocked in from ${new Date(conflict.clockedInAt).toLocaleString()}. Close that punch before starting a new shift  -  open shifts are capped at ${Math.round(conflict.maxShiftMinutes / 60)} hours.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="close-previous-punch">Clock-out for the previous punch</Label>
          <Input
            id="close-previous-punch"
            type="datetime-local"
            value={closeAt}
            onChange={(event) => setCloseAt(event.target.value)}
          />
          <p className="text-xs text-sand-ink">
            Use the real time you finished working (the suggested value is capped at the maximum
            shift).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConflict(null)}>
            Cancel
          </Button>
          <Button
            disabled={!closeAt || closeAndClockInMutation.isPending}
            onClick={() => {
              if (!conflict) return;
              closeAndClockInMutation.mutate({ close: closeAt });
            }}
          >
            {closeAndClockInMutation.isPending ? 'Saving…' : 'Close & clock in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (clockedInAt) {
    if (variant === 'compact') {
      return (
        <>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${needsReview ? 'bg-orange-500' : 'bg-green-600'}`}
              aria-hidden
            />
            <span className="font-mono text-xs text-espresso">{elapsed}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
              className="border-mist text-espresso"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              {clockOutMutation.isPending ? 'Clocking out...' : 'Clock Out'}
            </Button>
          </div>
          {conflictDialog}
        </>
      );
    }

    return (
      <>
        <div className="flex items-center gap-3">
          {needsReview ? (
            <Badge variant="secondary" className="gap-1.5 bg-orange-100 text-orange-800">
              <Clock className="h-3 w-3" />
              Needs review
            </Badge>
          ) : (
            <Badge variant="default" className="bg-green-100 text-green-800 gap-1.5">
              <Clock className="h-3 w-3" />
              Clocked In
            </Badge>
          )}
          <span className="font-mono text-sm text-espresso">{elapsed}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clockOutMutation.mutate()}
            disabled={clockOutMutation.isPending}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {clockOutMutation.isPending ? 'Clocking out...' : 'Clock Out'}
          </Button>
        </div>
        {conflictDialog}
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => clockInMutation.mutate()}
          disabled={clockInMutation.isPending}
          className="border-mist text-espresso"
        >
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          {clockInMutation.isPending ? 'Clocking in...' : 'Clock In'}
        </Button>
        {conflictDialog}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="gap-1.5">
          <Clock className="h-3 w-3" />
          Not Clocked In
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => clockInMutation.mutate()}
          disabled={clockInMutation.isPending}
        >
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          {clockInMutation.isPending ? 'Clocking in...' : 'Clock In'}
        </Button>
      </div>
      {conflictDialog}
    </>
  );
}
