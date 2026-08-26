'use client';

import { useState } from 'react';
import { useAppointments } from '@/hooks/appointments';
import { StatusBadge } from '../shared/StatusBadge';
import { AppointmentFilters } from './AppointmentFilters';
import { Button } from '@/components/ui/button';
import { EmptyState } from '../shared/EmptyState';
import { CalendarDays } from 'lucide-react';

interface AppointmentListViewProps {
  onAppointmentClick: (id: string) => void;
  onNewClick: () => void;
}

export function AppointmentListView({ onAppointmentClick, onNewClick }: AppointmentListViewProps) {
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const filters = {
    ...(status ? { status: status as 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom).toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + 'T23:59:59').toISOString() } : {}),
    page,
    limit: 20,
  };

  const { data, isLoading } = useAppointments(filters);
  const appointments = (data?.appointments ?? []) as Array<{ id: string; title: string; status: string; startTime: string; price: number; customer?: { name: string } | null; walkInName?: string | null; service?: { name: string } | null; staff?: { email: string } | null }>;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <AppointmentFilters
          status={status}
          onStatusChange={(s) => { setStatus(s); setPage(1); }}
          dateFrom={dateFrom}
          onDateFromChange={(d) => { setDateFrom(d); setPage(1); }}
          dateTo={dateTo}
          onDateToChange={(d) => { setDateTo(d); setPage(1); }}
        />
        <Button onClick={onNewClick}>New Appointment</Button>
      </div>

      {isLoading && <div className="py-8 text-center text-espresso/40">Loading...</div>}

      {!isLoading && appointments.length === 0 && (
        <EmptyState
          icon={<CalendarDays className="h-12 w-12" />}
          title="No appointments found"
          description="Create a new appointment or adjust your filters."
          action={<Button onClick={onNewClick}>New Appointment</Button>}
        />
      )}

      {!isLoading && appointments.length > 0 && (
        <>
          <div className="rounded-lg border border-espresso/10">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/10 bg-espresso/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Price</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr
                    key={appt.id}
                    className="border-b border-espresso/5 hover:bg-espresso/5 cursor-pointer transition-colors"
                    onClick={() => onAppointmentClick(appt.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-espresso">{appt.title}</div>
                      <div className="text-xs text-espresso/40">
                        {new Date(appt.startTime).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso">
                      {appt.customer?.name ?? appt.walkInName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso/60">
                      {appt.service?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso/60">
                      {appt.staff?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appt.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso">
                      ${Number(appt.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-espresso/60">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
