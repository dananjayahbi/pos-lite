'use client';

import { useState } from 'react';
import { useAppointments, useMarkNoShow } from '@/hooks/appointments';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { appointmentDisplayStatus } from '@/lib/appointments/appointmentOverdue.core';
import type { AppointmentStatus } from '@/generated/prisma/client';
import { StatusBadge } from '../shared/StatusBadge';
import { AppointmentFilters } from './AppointmentFilters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '../shared/EmptyState';
import { AppointmentSummaryCards } from '../stats/AppointmentSummaryCards';
import { CalendarDays } from 'lucide-react';
import { staffDisplayName } from '@/lib/utils/staff-name';
import { formatRupee } from '@/lib/format';

interface AppointmentListViewProps {
  onAppointmentClick: (id: string) => void;
  onNewClick: () => void;
}

interface AppointmentListRow {
  id: string;
  title: string;
  status: string;
  startTime: string;
  price: number | string;
  isPaid: boolean;
  depositAmount: number | string | null;
  saleId: string | null;
  customer?: { name: string } | null;
  walkInName?: string | null;
  service?: { name: string } | null;
  staff?: { email: string } | null;
}

/**
 * ARGUS #121 — the list used to show only the catalogue price, so a booking
 * that had taken a deposit (or had already been converted to a sale) looked
 * identical to one nobody had paid for.
 */
function PaymentState({ appointment }: { appointment: AppointmentListRow }) {
  if (appointment.saleId) {
    return (
      <Badge variant="success" className="text-[10px]">
        Sale recorded
      </Badge>
    );
  }
  if (appointment.isPaid) {
    return (
      <Badge variant="success" className="text-[10px]">
        Paid
      </Badge>
    );
  }
  const deposit = Number(appointment.depositAmount ?? 0);
  if (deposit > 0) {
    return (
      <Badge variant="warning" className="text-[10px]">
        Deposit {formatRupee(deposit)}
      </Badge>
    );
  }
  return <span className="text-xs text-espresso/40">Unpaid</span>;
}

export function AppointmentListView({ onAppointmentClick, onNewClick }: AppointmentListViewProps) {
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const { hasPermission } = usePermissions();
  const noShow = useMarkNoShow();
  const canMarkNoShow = hasPermission(PERMISSIONS.APPOINTMENT.editAppointment);

  const filters = {
    ...(status ? { status: status as 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'OVERDUE' } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom).toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + 'T23:59:59').toISOString() } : {}),
    page,
    limit: 20,
  };

  const { data, isLoading } = useAppointments(filters);
  const appointments = (data?.appointments ?? []) as AppointmentListRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <AppointmentSummaryCards />

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Payment</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const displayStatus = appointmentDisplayStatus({
                    status: appt.status as AppointmentStatus,
                    startTime: appt.startTime,
                  });
                  const overdue = displayStatus === 'OVERDUE';

                  return (
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
                      {appt.customer?.name ?? appt.walkInName ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso/60">
                      {appt.service?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso/60">
                      {appt.staff ? staffDisplayName(appt.staff.email) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={displayStatus} />
                      {overdue && canMarkNoShow ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1 h-7 border-red-300 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={noShow.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (
                              window.confirm(
                                'Mark this overdue appointment as a no-show? The customer will be recorded as not having attended.',
                              )
                            ) {
                              noShow.mutate(appt.id);
                            }
                          }}
                        >
                          Mark no-show
                        </Button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso">
                      {formatRupee(appt.price)}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentState appointment={appt} />
                    </td>
                  </tr>
                  );
                })}
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
