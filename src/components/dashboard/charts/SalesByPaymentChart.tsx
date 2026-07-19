'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentBreakdown } from './types';

const COLORS: Record<string, string> = {
  CASH: '#22c55e',
  CARD: '#3b82f6',
  STORE_CREDIT: '#a855f7',
  BANK_TRANSFER: '#f59e0b',
  OTHER: '#D1C7BD',
};

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

interface SalesByPaymentChartProps {
  data: PaymentBreakdown[];
}

export function SalesByPaymentChart({ data }: SalesByPaymentChartProps) {
  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-espresso">
          Sales by Payment
        </CardTitle>
        <p className="text-xs text-sand">Last 7 days</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-sand">
            No payment data yet.
          </p>
        ) : (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="total"
                  nameKey="method"
                  strokeWidth={0}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.method}
                      fill={COLORS[entry.method] ?? '#D1C7BD'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #D1C7BD',
                    fontSize: 12,
                  }}
                  formatter={(value) => [lkr.format(Number(value)), 'Total']}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="flex-1 space-y-2">
              {data.map((d) => (
                <div key={d.method} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[d.method] ?? COLORS.OTHER }}
                  />
                  <span className="flex-1 text-espresso capitalize">
                    {d.method.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <span className="font-medium text-espresso">
                    {total > 0 ? Math.round((d.total / total) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
