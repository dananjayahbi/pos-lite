'use client';

import { Button } from '@/components/ui/button';
import { useCheckInAppointment, useCompleteAppointment, useMarkNoShow, useCancelAppointment, useConvertToSale } from '@/hooks/appointments';
import type { AppointmentStatus } from '@/generated/prisma/client';

interface AppointmentActionsProps {
  appointmentId: string;
  status: string;
}

export function AppointmentActions({ appointmentId, status }: AppointmentActionsProps) {
  const checkIn = useCheckInAppointment();
  const complete = useCompleteAppointment();
  const noShow = useMarkNoShow();
  const cancel = useCancelAppointment();
  const convertToSale = useConvertToSale();

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'SCHEDULED' && (
        <>
          <Button size="sm" onClick={() => checkIn.mutate(appointmentId)} disabled={checkIn.isPending}>
            Check In
          </Button>
          <Button size="sm" variant="destructive" onClick={() => cancel.mutate({ id: appointmentId })} disabled={cancel.isPending}>
            Cancel
          </Button>
        </>
      )}
      {status === 'CONFIRMED' && (
        <>
          <Button size="sm" onClick={() => checkIn.mutate(appointmentId)} disabled={checkIn.isPending}>
            Check In
          </Button>
          <Button size="sm" variant="destructive" onClick={() => cancel.mutate({ id: appointmentId })} disabled={cancel.isPending}>
            Cancel
          </Button>
        </>
      )}
      {status === 'CHECKED_IN' && (
        <Button size="sm" onClick={() => complete.mutate(appointmentId)} disabled={complete.isPending}>
          Complete
        </Button>
      )}
      {status === 'COMPLETED' && (
        <Button size="sm" variant="outline" onClick={() => convertToSale.mutate(appointmentId)} disabled={convertToSale.isPending}>
          Convert to Sale
        </Button>
      )}
      {status === 'NO_SHOW' && (
        <Button size="sm" variant="outline" onClick={() => checkIn.mutate(appointmentId)} disabled={checkIn.isPending}>
          Rebook
        </Button>
      )}
    </div>
  );
}
