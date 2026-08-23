'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DeliveryRecoveryAttempt } from '@/types/delivery';

const ACTION_LABELS: Record<string, string> = {
  FOLLOW_UP_CALL: 'Follow-up Call',
  RESCHEDULED: 'Rescheduled',
  REDELIVERED: 'Redelivered',
  CANCELLED: 'Cancelled',
};

const ACTION_COLORS: Record<string, string> = {
  FOLLOW_UP_CALL: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  RESCHEDULED: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  REDELIVERED: 'bg-green-100 text-green-800 hover:bg-green-100',
  CANCELLED: 'bg-red-100 text-red-800 hover:bg-red-100',
};

/** Full recovery attempt history for a delivery (doc 45 step 4). */
export function RecoveryAttempts({
  attempts,
}: {
  attempts?: DeliveryRecoveryAttempt[] | null | undefined;
}) {
  const list = attempts ?? [];
  if (list.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-espresso">Recovery History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-espresso/50">No recovery attempts recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-espresso">Recovery History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.map((attempt) => (
          <div key={attempt.id} className="flex items-start justify-between gap-3 rounded-lg bg-espresso/5 px-3 py-2">
            <div className="space-y-0.5">
              <Badge
                variant="outline"
                className={ACTION_COLORS[attempt.action] ?? 'bg-gray-100 text-gray-700 hover:bg-gray-100'}
              >
                {ACTION_LABELS[attempt.action] ?? attempt.action}
              </Badge>
              {attempt.notes && <p className="text-sm text-espresso/70">{attempt.notes}</p>}
              <p className="text-xs text-espresso/40">
                {attempt.staff?.email ?? 'Unknown staff'} ·{' '}
                {new Date(attempt.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {attempt.redeliveryShipmentId && ' · New shipment created'}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
