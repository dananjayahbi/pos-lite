'use client';

import { useAppointmentStats } from '@/hooks/appointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AppointmentSummaryCards() {
  const today = new Date().toISOString().split('T')[0];
  const { data: stats } = useAppointmentStats(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-espresso/60">Today&apos;s Total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-espresso">{stats?.total ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-espresso/60">Completed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">{stats?.byStatus?.COMPLETED ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-espresso/60">No-Show Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">{stats?.noShowRate ?? 0}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-espresso/60">Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-espresso">${(stats?.revenue ?? 0).toFixed(2)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
