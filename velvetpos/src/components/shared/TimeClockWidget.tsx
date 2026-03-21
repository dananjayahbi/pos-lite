'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';

function formatDuration(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function TimeClockWidget() {
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const [elapsed, setElapsed] = useState('00:00');

  const { data: staffData } = useQuery<{ success: boolean; data: { clockedInAt: string | null } }>({
    queryKey: ['staff-detail', sessionData?.user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/store/staff/${sessionData!.user!.id}`);
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    enabled: !!sessionData?.user?.id,
  });

  const clockedInAt = staffData?.data?.clockedInAt ?? null;

  const updateElapsed = useCallback(() => {
    if (clockedInAt) {
      setElapsed(formatDuration(clockedInAt));
    }
  }, [clockedInAt]);

  useEffect(() => {
    if (!clockedInAt) {
      setElapsed('00:00');
      return;
    }
    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [clockedInAt, updateElapsed]);

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
      queryClient.invalidateQueries({ queryKey: ['staff-detail', sessionData?.user?.id] });
      queryClient.invalidateQueries({ queryKey: ['timeclock'] });
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
      queryClient.invalidateQueries({ queryKey: ['staff-detail', sessionData?.user?.id] });
      queryClient.invalidateQueries({ queryKey: ['timeclock'] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (clockedInAt) {
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
