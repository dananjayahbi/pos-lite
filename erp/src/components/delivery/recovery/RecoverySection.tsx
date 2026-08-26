'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FailureReasonTag } from '../FailureReasonTag';
import { RecoveryAttempts } from './RecoveryAttempts';
import { RecoveryActionDialog, type RecoveryActionKind } from './RecoveryActionDialog';
import {
  useLogRecoveryAction,
  useRedeliverDelivery,
  usePermanentCancelDelivery,
} from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import type { DeliveryDetail } from '@/types/delivery';

const RECOVERABLE_STATUSES = ['FAILED', 'RETURNED'];

/**
 * Failed-order recovery section (docs 43/44/45). Rendered on the delivery detail
 * panel for failed/recoverable deliveries: surfaces the courier failure reason,
 * exposes follow-up/reschedule/redeliver/permanent-cancel actions, and lists the
 * full recovery attempt history.
 */
export function RecoverySection({ delivery }: { delivery: DeliveryDetail }) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.DELIVERY.manageRecovery);

  const logAction = useLogRecoveryAction();
  const redeliver = useRedeliverDelivery();
  const cancel = usePermanentCancelDelivery();

  const [dialog, setDialog] = useState<RecoveryActionKind | null>(null);

  const recoverable = RECOVERABLE_STATUSES.includes(delivery.status);
  const hasHistory = (delivery.attempts?.length ?? 0) > 0;
  const showFailure = !!delivery.failureReason;

  const submitting =
    logAction.isPending || redeliver.isPending || cancel.isPending;

  if (!canManage && !showFailure && !hasHistory && !recoverable) return null;

  function handleSubmit(values: {
    notes?: string | undefined;
    reason?: string | undefined;
    waybillMode?: string;
    manualWaybillId?: string | undefined;
  }) {
    if (!dialog) return;
    if (dialog === 'FOLLOW_UP_CALL' || dialog === 'RESCHEDULED') {
      logAction.mutate({ id: delivery.id, action: dialog, notes: values.notes });
    } else if (dialog === 'REDELIVERED') {
      redeliver.mutate({
        id: delivery.id,
        data: {
          waybillMode: values.waybillMode ?? 'AUTO',
          manualWaybillId: values.manualWaybillId,
          notes: values.notes,
        },
      });
    } else if (dialog === 'CANCELLED') {
      cancel.mutate({ id: delivery.id, data: { reason: values.reason, notes: values.notes } });
    }
    setDialog(null);
  }

  return (
    <div className="space-y-4">
      {showFailure && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-700">Delivery Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <FailureReasonTag reason={delivery.failureReason} />
            <p className="mt-2 text-sm text-espresso/60">
              Use the actions below to recover this delivery.
            </p>
          </CardContent>
        </Card>
      )}

      {canManage && recoverable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-espresso">Recovery Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialog('FOLLOW_UP_CALL')}>
                Follow-up Call
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog('RESCHEDULED')}>
                Reschedule
              </Button>
              <Button size="sm" variant="default" onClick={() => setDialog('REDELIVERED')}>
                Redeliver
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-terracotta"
                onClick={() => setDialog('CANCELLED')}
              >
                Permanent Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasHistory && <RecoveryAttempts attempts={delivery.attempts} />}

      <RecoveryActionDialog
        open={!!dialog}
        kind={dialog ?? 'FOLLOW_UP_CALL'}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
        withWaybill={dialog === 'REDELIVERED'}
      />
    </div>
  );
}
