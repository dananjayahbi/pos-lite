'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TimeClockHistoryPanel } from '@/components/staff/TimeClockHistoryPanel';
import { TimeClockWidget } from '@/components/shared/TimeClockWidget';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StaffMember {
  id: string;
  email: string;
  role: string;
}

export default function TimeclockPage() {
  const { data: sessionData } = useSession();
  const [selectedUserId, setSelectedUserId] = useState('');

  const sessionRole = sessionData?.user?.role ?? '';
  const sessionUserId = sessionData?.user?.id ?? '';
  const canBrowseTeam = sessionRole === 'OWNER' || sessionRole === 'MANAGER';

  const { data: staffData } = useQuery<{ success: boolean; data: StaffMember[] }>({
    queryKey: ['staff', 'timeclock-filter'],
    queryFn: async () => {
      const res = await fetch('/api/store/staff');
      if (!res.ok) throw new Error('Failed to fetch staff members');
      return res.json();
    },
    enabled: canBrowseTeam,
  });

  useEffect(() => {
    if (!selectedUserId && sessionUserId) {
      setSelectedUserId(sessionUserId);
    }
  }, [selectedUserId, sessionUserId]);

  const staff = staffData?.data ?? [];
  const selectedStaff = useMemo(
    () => staff.find((member) => member.id === selectedUserId),
    [selectedUserId, staff],
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Attendance</h1>
        <p className="mt-1 text-sm text-sand">
          Review time clock history and today&apos;s attendance activity outside the staff detail tabs.
        </p>
      </div>

      <section className="rounded-2xl border border-mist/60 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">Clock actions</p>
            <p className="mt-1 text-sm text-espresso/70">
              Use your own time clock controls here without opening the staff profile first.
            </p>
          </div>
          <TimeClockWidget />
        </div>
      </section>

      {canBrowseTeam && (
        <section className="rounded-2xl border border-mist/60 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">Attendance scope</p>
              <p className="mt-1 text-sm text-espresso/70">
                Switch between staff members to review their clock events and totals.
              </p>
            </div>
            <div className="w-full md:max-w-xs">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      )}

      {selectedUserId && (
        <ErrorBoundary>
          <TimeClockHistoryPanel
            staffId={selectedUserId}
            title={selectedStaff ? `${selectedStaff.email} — Time Clock` : 'Time Clock History'}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
