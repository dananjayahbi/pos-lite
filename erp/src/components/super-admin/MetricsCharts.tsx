'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLKR } from '@/lib/format';

interface RevenueByPlan {
  planName: string;
  activeCount: number;
  monthlyCumulativeRevenue: number;
}

interface MetricsChartsProps {
  revenueByPlan: RevenueByPlan[];
}

const PLAN_COLORS: Record<string, string> = {
  STARTER: '#CBAD8D',   // sand
  GROWTH: '#A48374',     // terracotta
  ENTERPRISE: '#3A2D28', // espresso
};

const FALLBACK_COLOR = '#D1C7BD'; // mist

function getPlanColor(planName: string): string {
  return PLAN_COLORS[planName.toUpperCase()] ?? FALLBACK_COLOR;
}

export default function MetricsCharts({ revenueByPlan }: MetricsChartsProps) {
  const totalRevenue = revenueByPlan.reduce((sum, p) => sum + p.monthlyCumulativeRevenue, 0);

  // Build conic-gradient segments
  const segments: string[] = [];
  let cumulativePercent = 0;

  for (const plan of revenueByPlan) {
    const percent = totalRevenue > 0 ? (plan.monthlyCumulativeRevenue / totalRevenue) * 100 : 0;
    const color = getPlanColor(plan.planName);
    segments.push(`${color} ${cumulativePercent}% ${cumulativePercent + percent}%`);
    cumulativePercent += percent;
  }

  // If no data, show full mist
  const gradient =
    segments.length > 0
      ? `conic-gradient(${segments.join(', ')})`
      : `conic-gradient(${FALLBACK_COLOR} 0% 100%)`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-espresso">Revenue by Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Donut Chart */}
          <div className="relative h-48 w-48 shrink-0">
            <div
              className="h-full w-full rounded-full"
              style={{ background: gradient }}
            />
            {/* Inner white circle for donut effect */}
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="font-mono text-sm font-bold text-espresso">
                {formatLKR(totalRevenue)}
              </p>
              <p className="text-xs text-mist">MRR</p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-3">
            {revenueByPlan.map((plan) => (
              <div key={plan.planName} className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: getPlanColor(plan.planName) }}
                />
                <div>
                  <p className="text-sm font-medium text-espresso">{plan.planName}</p>
                  <p className="font-mono text-xs text-mist">
                    {formatLKR(plan.monthlyCumulativeRevenue)} · {plan.activeCount} subscriber
                    {plan.activeCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
            {revenueByPlan.length === 0 && (
              <p className="text-sm text-mist">No active plans</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
