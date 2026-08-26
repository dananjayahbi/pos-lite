'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from '../shared/StatusBadge';
import { AppointmentStatusTimeline } from './AppointmentStatusTimeline';
import { AppointmentActions } from './AppointmentActions';
import { useAppointment } from '@/hooks/appointments';

interface AppointmentDetailPanelProps {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AppointmentDetailPanel({ appointmentId, open, onClose }: AppointmentDetailPanelProps) {
  const { data: appointment, isLoading } = useAppointment(appointmentId);

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
              <StatusBadge status={appointment.status} />
            </div>

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
                    {' — '}
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
                  <p className="text-espresso/60 text-xs">
                    {appointment.service.durationMins} min · ${Number(appointment.price).toFixed(2)}
                  </p>
                </div>
              )}

              {appointment.staff && (
                <div>
                  <span className="text-espresso/50">Staff</span>
                  <p className="text-espresso font-medium">{appointment.staff.email}</p>
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

            <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
