'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { StatusBadge } from '../shared/StatusBadge';
import { AppointmentStatusTimeline } from './AppointmentStatusTimeline';
import { AppointmentActions } from './AppointmentActions';
import { useAppointment } from '@/hooks/appointments';
import {
  APPOINTMENT_OVERDUE_GRACE_MINUTES,
  appointmentDisplayStatus,
} from '@/lib/appointments/appointmentOverdue.core';
import { buildAppointmentDetailView } from '@/lib/appointments/appointmentDetail.core';
import type { AppointmentStatus } from '@/generated/prisma/client';
import { staffDisplayName } from '@/lib/utils/staff-name';
import { formatRupee } from '@/lib/format';

interface AppointmentDetailPanelProps {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AppointmentDetailPanel({ appointmentId, open, onClose }: AppointmentDetailPanelProps) {
  const { data: appointment, isLoading } = useAppointment(appointmentId);
  const displayStatus = appointment
    ? appointmentDisplayStatus({
        status: appointment.status as AppointmentStatus,
        startTime: appointment.startTime,
      })
    : null;
  const overdue = displayStatus === 'OVERDUE';
  const view = appointment
    ? buildAppointmentDetailView({
        status: appointment.status as AppointmentStatus,
        price: appointment.price,
        depositAmount: appointment.depositAmount,
        isPaid: appointment.isPaid,
        saleId: appointment.saleId,
        sale: appointment.sale ?? null,
        serviceName: appointment.service?.name ?? null,
        cancellationReason: appointment.cancellationReason,
        cancelledAt: appointment.cancelledAt,
        cancelledByEmail: appointment.cancelledBy?.email ?? null,
        reminders: appointment.reminders ?? [],
      })
    : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[400px] sm:max-w-[400px] overflow-auto">
        <SheetHeader>
          <SheetTitle>Appointment Details</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="py-8 text-center text-espresso/40">Loading...</div>
        )}

        {!isLoading && !appointment && (
          <div className="py-8 text-center text-espresso/40">Appointment not found</div>
        )}

        {appointment && view && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-espresso">{appointment.title}</h2>
              <StatusBadge status={displayStatus ?? appointment.status} />
            </div>

            {overdue ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                This appointment is past its start time by more than{' '}
                {APPOINTMENT_OVERDUE_GRACE_MINUTES} minutes. Mark it as a no-show, or check the
                customer in as a late arrival.
              </div>
            ) : null}

            <AppointmentStatusTimeline status={appointment.status} />

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-espresso/50">Date</span>
                  <p className="text-espresso font-medium">
                    {new Date(appointment.startTime).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-espresso/50">Time</span>
                  <p className="text-espresso font-medium">
                    {new Date(appointment.startTime).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {' - '}
                    {new Date(appointment.endTime).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {appointment.customer && (
                <div>
                  <span className="text-espresso/50">Customer</span>
                  <p className="text-espresso font-medium">{appointment.customer.name}</p>
                  <p className="text-espresso/60 text-xs">{appointment.customer.phone}</p>
                </div>
              )}

              {(appointment.walkInName || appointment.walkInPhone) && (
                <div>
                  <span className="text-espresso/50">Walk-in Customer</span>
                  <p className="text-espresso font-medium">{appointment.walkInName}</p>
                  {appointment.walkInPhone && <p className="text-espresso/60 text-xs">{appointment.walkInPhone}</p>}
                </div>
              )}

              <div>
                <span className="text-espresso/50">Service</span>
                <p className="text-espresso font-medium">{view.serviceLabel}</p>
                {appointment.service ? (
                  <p className="text-espresso/60 text-xs">{appointment.service.durationMins} min</p>
                ) : null}
              </div>

              {/* ARGUS #128: price is always shown (service is optional), and
                  deposit/paid/balance/sale state stay visible. */}
              <div>
                <span className="text-espresso/50">Payment</span>
                <p className="text-espresso font-medium">{formatRupee(view.price)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={view.paymentState === 'UNPAID' ? 'warning' : 'success'}
                    className="text-[10px]"
                  >
                    {view.paymentLabel}
                  </Badge>
                  {view.depositAmount > 0 ? (
                    <span className="text-espresso/60 text-xs">
                      Deposit {formatRupee(view.depositAmount)}
                    </span>
                  ) : null}
                  {view.saleId ? (
                    <Link
                      href={`/sales/${view.saleId}`}
                      className="text-espresso/70 font-mono text-xs underline"
                    >
                      Sale {view.saleShortId}
                    </Link>
                  ) : null}
                </div>
                {view.balanceDue > 0 ? (
                  <p className="text-espresso/50 mt-1 text-xs">
                    Balance {formatRupee(view.balanceDue)} due on completion.
                  </p>
                ) : null}
              </div>

              {view.cancellation ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                  <span className="text-xs font-semibold uppercase tracking-wide">Cancellation</span>
                  <p className="mt-1 text-sm">{view.cancellation.reason ?? 'No reason recorded.'}</p>
                  {view.cancellation.at ? (
                    <p className="mt-1 text-xs">
                      Cancelled{' '}
                      {new Date(view.cancellation.at).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  ) : null}
                  {view.cancellation.byEmail ? (
                    <p className="text-xs">By {staffDisplayName(view.cancellation.byEmail)}</p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <span className="text-espresso/50">Reminders</span>
                {view.reminders.total === 0 ? (
                  <p className="text-espresso/70">No reminders scheduled.</p>
                ) : (
                  <>
                    <p className="text-espresso font-medium">
                      {view.reminders.total} scheduled · {view.reminders.sent} sent ·{' '}
                      {view.reminders.pending} pending
                      {view.reminders.failed > 0 ? ` · ${view.reminders.failed} failed` : ''}
                    </p>
                    {view.reminders.nextScheduledFor ? (
                      <p className="text-espresso/60 text-xs">
                        Next{' '}
                        {new Date(view.reminders.nextScheduledFor).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                    {view.reminders.lastSentAt ? (
                      <p className="text-espresso/60 text-xs">
                        Last sent{' '}
                        {new Date(view.reminders.lastSentAt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {appointment.staff && (
                <div>
                  <span className="text-espresso/50">Staff</span>
                  <p className="text-espresso font-medium">{staffDisplayName(appointment.staff.email)}</p>
                </div>
              )}

              {appointment.notes && (
                <div>
                  <span className="text-espresso/50">Notes</span>
                  <p className="text-espresso/70">{appointment.notes}</p>
                </div>
              )}

              {appointment.customerNotes && (
                <div>
                  <span className="text-espresso/50">Customer Notes</span>
                  <p className="text-espresso/70">{appointment.customerNotes}</p>
                </div>
              )}
            </div>

            <AppointmentActions appointment={appointment} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
