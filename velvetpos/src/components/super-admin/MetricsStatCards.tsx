'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatLKR } from '@/lib/format';

interface MetricsStatCardsProps {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  trialSubscribers: number;
  trialConversionRate: number;
  churnedLast30Days: number;
  netChurnRate: number;
}

interface StatCardProps {
  label: string;
  value: string;
  isMono?: boolean | undefined;
}

function StatCard({ label, value, isMono }: StatCardProps) {
  return (
    <Card className="border-t-[3px] border-t-espresso">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-mist">{label}</p>
        <p className={`mt-1 text-2xl font-bold text-espresso ${isMono ? 'font-mono' : ''}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default function MetricsStatCards({
  mrr,
  arr,
  activeSubscribers,
  trialSubscribers,
  trialConversionRate,
  churnedLast30Days,
  netChurnRate,
}: MetricsStatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Monthly Recurring Revenue" value={formatLKR(mrr)} isMono />
      <StatCard label="Annual Recurring Revenue" value={formatLKR(arr)} isMono />
      <StatCard label="Active Subscribers" value={String(activeSubscribers)} />
      <StatCard label="Trial Subscribers" value={String(trialSubscribers)} />
      <StatCard label="Trial Conversion (30d)" value={`${trialConversionRate}%`} />
      <StatCard label="Churned (30d)" value={String(churnedLast30Days)} />
      <StatCard label="Net Churn Rate" value={`${netChurnRate}%`} />
      <Card className="border-t-[3px] border-t-espresso">
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">MRR Growth</p>
          <p className="mt-1 text-sm text-terracotta">Coming Soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
