'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TopProduct } from './types';

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

interface TopProductsChartProps {
  data: TopProduct[];
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  const truncated = data.map((d) => ({
    ...d,
    shortName: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-espresso">
          Top Products
        </CardTitle>
        <p className="text-xs text-sand">By revenue · Last 7 days</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-sand">
            No product sales yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={truncated} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#D1C7BD"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#CBAD8D' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={120}
                tick={{ fontSize: 11, fill: '#3A2D28' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #D1C7BD',
                  fontSize: 12,
                }}
                formatter={(value) => [lkr.format(Number(value)), 'Revenue']}
                labelFormatter={(label) => {
                  const item = truncated.find((t) => t.shortName === label);
                  return item?.name ?? String(label);
                }}
              />
              <Bar
                dataKey="revenue"
                fill="#A48374"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
