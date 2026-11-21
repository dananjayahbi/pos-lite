'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useAppointmentSettings,
  useCancelAppointment,
  useCheckInAppointment,
  useCompleteAppointment,
  useConfirmAppointment,
  useConvertToSale,
  useMarkNoShow,
  useStartAppointment,
} from '@/hooks/appointments';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppointmentStore } from '@/stores/appointmentStore';
import { DEFAULT_APPOINTMENT_SETTINGS } from '@/lib/appointments/appointmentSettings.core';
import {
  APPOINTMENT_ACTION_PERMISSIONS,
  appointmentActionAllowed,
  buildAppointmentRebookSeed,
  type AppointmentLifecycleAction,
} from '@/lib/appointments/appointmentLifecycle.core';
import {
  APPOINTMENT_OVERDUE_GRACE_MINUTES,
  isAppointmentOverdue,
} from '@/lib/appointments/appointmentOverdue.core';
import type { PermissionKey } from '@/lib/constants/permissions';
import type { AppointmentStatus } from '@/generated/prisma/client';

interface AppointmentActionSubject {
  id: string;
  status: string;
  startTime: string;
  durationMins: number;
  title: string;
  price: number | string;
  saleId?: string | null;
  customerId?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  walkInName?: string | null;
  walkInPhone?: string | null;
  notes?: string | null;
  customerNotes?: string | null;
}

interface AppointmentActionsProps {
  appointment: AppointmentActionSubject;
}

/**
 * ARGUS #125 — actions are driven by the same transition map and permission
 * keys the API enforces. Terminal states offer Rebook (a NEW booking), not
 * check-in.
 */
export function AppointmentActions({ appointment }: AppointmentActionsProps) {
  const checkIn = useCheckInAppointment();
  const confirm = useConfirmAppointment();
  const start = useStartAppointment();
  const complete = useCompleteAppointment();
  const noShow = useMarkNoShow();
  const cancel = useCancelAppointment();
  const convertToSale = useConvertToSale();
  const openCreateForm = useAppointmentStore((s) => s.openCreateForm);

  const { hasPermission } = usePermissions();
  const { data: settings } = useAppointmentSettings();
  const effectiveSettings = settings ?? DEFAULT_APPOINTMENT_SETTINGS;
  const status = appointment.status as AppointmentStatus;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const can = (action: AppointmentLifecycleAction) =>
    APPOINTMENT_ACTION_PERMISSIONS[action].every((permission: PermissionKey) =>
      hasPermission(permission),
    ) && appointmentActionAllowed(status, action, effectiveSettings);

  const overdue = isAppointmentOverdue({ status, startTime: appointment.startTime });

  const showConfirm = status === 'SCHEDULED' && can('confirm');
  const showCheckIn =
    (status === 'SCHEDULED' || status === 'CONFIRMED') && can('check_in');
  const showStart = status === 'CHECKED_IN' && can('start');
  const showComplete =
    (status === 'CHECKED_IN' ||
      status === 'IN_PROGRESS' ||
      (status === 'SCHEDULED' && !overdue)) &&
    can('complete');
  const showNoShow =
    (status === 'SCHEDULED' || status === 'CONFIRMED') && can('no_show');
  const showCancel =
    (status === 'SCHEDULED' ||
      status === 'CONFIRMED' ||
      status === 'CHECKED_IN' ||
      status === 'IN_PROGRESS') &&
    can('cancel');
  const showRebook = can('rebook');
  const showConvert = can('convert_to_sale') && !appointment.saleId;

  const handleNoShow = () => {
    if (
      window.confirm(
        'Mark this appointment as a no-show? The customer will be recorded as not having attended.',
      )
    ) {
      noShow.mutate(appointment.id);
    }
  };

  const handleCheckIn = () => {
    if (
      overdue &&
      !window.confirm(
        `This appointment is ${APPOINTMENT_OVERDUE_GRACE_MINUTES}+ minutes past its start time. Check the customer in as a late arrival?`,
      )
    ) {
      return;
    }
    checkIn.mutate(appointment.id);
  };

  const handleRebook = () => {
    // A fresh booking, one week later, with the same customer/service/staff.
    openCreateForm({ ...buildAppointmentRebookSeed(appointment) });
  };

  const submitCancel = () => {
    const reason = cancelReason.trim();
    if (!reason) return;
    cancel.mutate(
      { id: appointment.id, reason },
      {
        onSuccess: () => {
          setCancelOpen(false);
          setCancelReason('');
        },
      },
    );
  };

  const hasAnyAction =
    showConfirm ||
    showCheckIn ||
    showStart ||
    showComplete ||
    showNoShow ||
    showCancel ||
    showRebook ||
    showConvert ||
    status === 'COMPLETED';

  if (!hasAnyAction) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {overdue && showNoShow && (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleNoShow}
          disabled={noShow.isPending}
        >
          Mark no-show
        </Button>
      )}
      {showConfirm && (
        <Button
          size="sm"
          variant={showCheckIn ? 'outline' : 'default'}
          onClick={() => confirm.mutate(appointment.id)}
          disabled={confirm.isPending}
        >
          Confirm
        </Button>
      )}
      {showCheckIn && (
        <Button
          size="sm"
          variant="default"
          onClick={handleCheckIn}
          disabled={checkIn.isPending}
        >
          {overdue ? 'Check in (late)' : 'Check In'}
        </Button>
      )}
      {showStart && (
        <Button size="sm" onClick={() => start.mutate(appointment.id)} disabled={start.isPending}>
          Start
        </Button>
      )}
      {showComplete && (
        <Button
          size="sm"
          variant={showStart ? 'outline' : 'default'}
          onClick={() => complete.mutate(appointment.id)}
          disabled={complete.isPending}
        >
          Complete
        </Button>
      )}
      {!overdue && showNoShow && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleNoShow}
          disabled={noShow.isPending}
          className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          No-show
        </Button>
      )}
      {showCancel && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setCancelOpen(true)}
          disabled={cancel.isPending}
        >
          Cancel
        </Button>
      )}
      {status === 'COMPLETED' &&
        (appointment.saleId ? (
          <span className="text-xs text-espresso/60 py-2">Sale recorded</span>
        ) : showConvert ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => convertToSale.mutate(appointment.id)}
            disabled={convertToSale.isPending}
          >
            Convert to Sale
          </Button>
        ) : null)}
      {showRebook && (
        <Button size="sm" variant="outline" onClick={handleRebook}>
          Rebook
        </Button>
      )}

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setCancelReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel appointment</DialogTitle>
            <DialogDescription>
              Record why this appointment is being cancelled. Any outstanding deposit is returned
              according to the cancellation policy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-cancel-reason">Reason (required)</Label>
            <Textarea
              id="appointment-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Customer called to cancel"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancel.isPending}>
              Keep appointment
            </Button>
            <Button
              variant="destructive"
              onClick={submitCancel}
              disabled={!cancelReason.trim() || cancel.isPending}
            >
              Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
