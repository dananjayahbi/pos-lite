'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '../shared/StatusBadge';
import { AppointmentStatusTimeline } from './AppointmentStatusTimeline';
import { AppointmentActions } from './AppointmentActions';
import { useAppointment } from '@/hooks/appointments';
import {
  APPOINTMENT_OVERDUE_GRACE_MINUTES,
  appointmentDisplayStatus,
} from '@/lib/appointments/appointmentOverdue.core';
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

        {appointment && (
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

              {appointment.service && (
                <div>
                  <span className="text-espresso/50">Service</span>
                  <p className="text-espresso font-medium">{appointment.service.name}</p>
                  <p className="text-espresso/60 text-xs">{appointment.service.durationMins} min</p>
                </div>
              )}

              {/* ARGUS #121: price, deposit, paid state and the linked sale used
                  to be invisible here, so a settled visit looked unpaid. */}
              <div>
                <span className="text-espresso/50">Payment</span>
                <p className="text-espresso font-medium">{formatRupee(appointment.price)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {appointment.saleId ? (
                    <Badge variant="success" className="text-[10px]">
                      Sale recorded
                    </Badge>
                  ) : appointment.isPaid ? (
                    <Badge variant="success" className="text-[10px]">
                      Paid
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">
                      Unpaid
                    </Badge>
                  )}
                  {Number(appointment.depositAmount ?? 0) > 0 && (
                    <span className="text-espresso/60 text-xs">
                      Deposit {formatRupee(Number(appointment.depositAmount))}
                    </span>
                  )}
                  {appointment.saleId && (
                    <span className="text-espresso/60 font-mono text-xs">
                      Sale {appointment.saleId.slice(0, 8).toUpperCase()}
                    </span>
                  )}
                </div>
                {!appointment.isPaid && !appointment.saleId && Number(appointment.depositAmount ?? 0) > 0 && (
                  <p className="text-espresso/50 mt-1 text-xs">
                    Balance {formatRupee(Math.max(Number(appointment.price) - Number(appointment.depositAmount), 0))}{' '}
                    due on completion.
                  </p>
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
