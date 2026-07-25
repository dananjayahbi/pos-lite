'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyRevenue } from './types';

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

interface RevenueTrendChartProps {
  data: DailyRevenue[];
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-LK', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-espresso">
          Revenue Trend
        </CardTitle>
        <p className="text-xs text-sand">Last 7 days</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-sand">
            No sales data yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={formatted}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A48374" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#A48374" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#D1C7BD" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#CBAD8D' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#CBAD8D' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #D1C7BD',
                  fontSize: 12,
                }}
                formatter={(value) => [lkr.format(Number(value)), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#A48374"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
