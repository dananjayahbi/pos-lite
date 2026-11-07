'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';

function formatDuration(startTime: string, nowMs: number): string {
  const start = new Date(startTime).getTime();
  const diffMs = Math.max(0, nowMs - start);
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

  const { data: statusData } = useQuery<{
    success: boolean;
    data: { clockedInAt: string | null; openRecordId: string | null };
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
  const elapsed = clockedInAt ? formatDuration(clockedInAt, nowMs) : '00:00';

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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Clock in failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Clocked in successfully');
      invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/timeclock/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Clock out failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Clocked out successfully');
      invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (clockedInAt) {
    if (variant === 'compact') {
      return (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-600" aria-hidden />
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
      );
    }

    return (
      <div className="flex items-center gap-3">
        <Badge variant="default" className="bg-green-100 text-green-800 gap-1.5">
          <Clock className="h-3 w-3" />
          Clocked In
        </Badge>
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
    );
  }

  if (variant === 'compact') {
    return (
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
    );
  }

  return (
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
  );
}
