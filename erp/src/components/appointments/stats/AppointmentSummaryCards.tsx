'use client';

import { useAppointmentStats, useAppointments } from '@/hooks/appointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee } from '@/lib/format';
import { APPOINTMENT_OVERDUE_GRACE_MINUTES } from '@/lib/appointments/appointmentOverdue.core';

interface StatsCard {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: string | undefined;
}

/**
 * ARGUS #121 — revenue now reflects money actually collected (paid visits at
 * price, otherwise the deposit taken at booking), and unpaid completed visits
 * are called out instead of hiding inside the completed count.
 */
export function AppointmentSummaryCards() {
  const today = new Date().toISOString().split('T')[0];
  const { data: stats } = useAppointmentStats(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
  // ARGUS #126: tenant-wide derived count, not a stored status. It is visible
  // regardless of the selected day so old unresolved rows cannot hide.
  const { data: overdueResult } = useAppointments({ status: 'OVERDUE', limit: 1 });
  const overdue = overdueResult?.total ?? 0;

  const completed = stats?.byStatus?.COMPLETED ?? 0;
  const unpaid = stats?.completedUnpaidCount ?? 0;

  const cards: StatsCard[] = [
    { label: "Today's Total", value: String(stats?.total ?? 0) },
    {
      label: 'Overdue',
      value: String(overdue),
      hint: overdue > 0 ? `Past the ${APPOINTMENT_OVERDUE_GRACE_MINUTES}-minute grace window` : 'None waiting',
      tone: overdue > 0 ? 'text-orange-600' : undefined,
    },
    { label: 'Completed', value: String(completed), tone: 'text-green-600' },
    {
      label: 'Completed Unpaid',
      value: String(unpaid),
      hint: unpaid > 0 ? `${formatRupee(stats?.outstandingBalance ?? 0)} still due` : 'All settled',
      tone: unpaid > 0 ? 'text-amber-600' : undefined,
    },
    {
      label: 'Collected',
      value: formatRupee(stats?.revenue ?? 0),
      hint: 'Paid visits at price, otherwise deposits',
    },
    {
      label: 'Deposits Held',
      value: formatRupee(stats?.depositsHeld ?? 0),
      hint: 'On bookings not yet paid in full',
    },
    {
      label: 'No-Show Rate',
      value: `${stats?.noShowRate ?? 0}%`,
      tone: 'text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.tone ?? 'text-espresso'}`}>{card.value}</p>
            {card.hint ? <p className="mt-1 text-xs text-espresso/50">{card.hint}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
