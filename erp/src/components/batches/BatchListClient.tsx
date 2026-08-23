'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBatches } from '@/hooks/useBatches';
import { BatchTable } from '@/components/batches/BatchTable';

const EXPIRY_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'EXPIRING_SOON', label: 'Expiring soon' },
  { value: 'OK', label: 'Okay' },
];

export function BatchListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? undefined;
  const expiryStatusRaw = searchParams.get('expiryStatus') ?? undefined;
  const expiryStatus =
    expiryStatusRaw === 'EXPIRED' || expiryStatusRaw === 'EXPIRING_SOON' || expiryStatusRaw === 'OK'
      ? expiryStatusRaw
      : undefined;

  const [searchInput, setSearchInput] = useState(search ?? '');

  useEffect(() => {
    setSearchInput(search ?? '');
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateParams({ search: searchInput || null, page: '1' });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useBatches({
    page,
    limit: 25,
    ...(search ? { search } : {}),
    ...(expiryStatus ? { expiryStatus } : {}),
  });

  const batches = data?.data ?? [];
  const meta = data?.meta;

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    router.replace(`/inventory/batches?${params.toString()}`);
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search product, SKU or batch..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={expiryStatus ?? ''}
          onValueChange={(v) => updateParams({ expiryStatus: v || null, page: '1' })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {EXPIRY_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard title="Total batches" value={meta?.totalBatches ?? 0} />
        <SummaryCard title="Healthy" value={meta?.healthyCount ?? 0} variant="ok" />
        <SummaryCard title="Expiring soon" value={meta?.expiringSoonCount ?? 0} variant="warn" />
        <SummaryCard title="Expired" value={meta?.expiredCount ?? 0} variant="danger" />
      </div>

      <BatchTable batches={batches} isLoading={isLoading} />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  variant,
}: {
  title: string;
  value: number;
  variant?: 'ok' | 'warn' | 'danger';
}) {
  const color =
    variant === 'danger'
      ? 'text-red-600'
      : variant === 'warn'
        ? 'text-amber-600'
        : variant === 'ok'
          ? 'text-emerald-600'
          : 'text-foreground';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
