'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ShiftOpenModal } from '@/components/pos/ShiftOpenModal';
import { ShiftCloseModal } from '@/components/pos/ShiftCloseModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatRupee } from '@/lib/format';
import { Eye, PlusCircle, Wallet } from 'lucide-react';

interface StaffMember {
  id: string;
  email: string;
}

interface ShiftRow {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingFloat: number | string;
  cashier: { id: string; email: string; role: string } | null;
  closure?: {
    expectedCash?: number | string;
    cashDifference?: number | string;
    closedAt?: string;
  } | null;
  _count?: { sales: number };
}

interface ShiftListResponse {
  success: boolean;
  data: ShiftRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function StatusBadge({ status }: { status: ShiftRow['status'] }) {
  return status === 'OPEN' ? (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Open</Badge>
  ) : (
    <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">
      Closed
    </Badge>
  );
}

export default function StaffShiftsPage() {
  const { data: sessionData } = useSession();
  const [status, setStatus] = useState('ALL');
  const [cashierId, setCashierId] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [openShiftFlow, setOpenShiftFlow] = useState(false);
  const [closeShiftId, setCloseShiftId] = useState<string | null>(null);
  const limit = 20;

  const { data: staffData } = useQuery<{ success: boolean; data: StaffMember[] }>({
    queryKey: ['staff', 'shift-filters'],
    queryFn: async () => {
      const res = await fetch('/api/store/staff');
      if (!res.ok) throw new Error('Failed to fetch staff members');
      return res.json();
    },
  });

  const { data: currentShiftData, isLoading: currentShiftLoading, refetch: refetchCurrentShift } = useQuery<{
    success: boolean;
    data: ShiftRow | null;
  }>({
    queryKey: ['current-shift'],
    queryFn: async () => {
      const res = await fetch('/api/store/shifts/current');
      if (!res.ok) throw new Error('Failed to fetch current shift');
      return res.json();
    },
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (cashierId !== 'ALL') params.set('cashierId', cashierId);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      params.set('to', toDate.toISOString());
    }
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [cashierId, from, page, status, to]);

  const { data, isLoading, refetch } = useQuery<ShiftListResponse>({
    queryKey: ['shifts', status, cashierId, from, to, page],
    queryFn: async () => {
      const res = await fetch(`/api/store/shifts?${queryString}`);
      if (!res.ok) throw new Error('Failed to fetch shifts');
      return res.json();
    },
  });

  const shifts = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, limit, total: 0, totalPages: 1 };
  const openCount = shifts.filter((shift) => shift.status === 'OPEN').length;
  const closedCount = shifts.filter((shift) => shift.status === 'CLOSED').length;
  const currentShift = currentShiftData?.data ?? null;
  const staff = staffData?.data ?? [];

  const refreshAfterShiftAction = () => {
    void refetch();
    void refetchCurrentShift();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Shifts</h1>
          <p className="mt-1 text-sm text-sand">
            Surface open and closed shifts, reconcile current tills, and jump into shift reports from one owner-facing hub.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentShift ? (
            <Button
              variant="outline"
              className="border-sand text-espresso"
              onClick={() => setCloseShiftId(currentShift.id)}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Close Current Shift
            </Button>
          ) : (
            <Button onClick={() => setOpenShiftFlow(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Open Shift
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sand">Visible open shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sand">Visible closed shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{closedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sand">My current shift</CardTitle>
          </CardHeader>
          <CardContent>
            {currentShiftLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : currentShift ? (
              <div className="space-y-1">
                <p className="font-semibold text-espresso">Opened {formatDateTime(currentShift.openedAt)}</p>
                <p className="text-sm text-sand">
                  Opening float {formatRupee(currentShift.openingFloat)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-sand">No active shift for your account.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="rounded-2xl border border-mist/60 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">Status</label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">Cashier</label>
            <Select
              value={cashierId}
              onValueChange={(value) => {
                setCashierId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All staff</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">From</label>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">To</label>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <Button
            variant="outline"
            className="border-sand text-espresso"
            onClick={() => {
              setStatus('ALL');
              setCashierId('ALL');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Reset filters
          </Button>
        </div>
      </section>

      <ErrorBoundary>
        <section className="overflow-hidden rounded-2xl border border-mist/60 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded" />
              ))}
            </div>
          ) : shifts.length === 0 ? (
            <div className="p-10 text-center text-sm text-sand">No shifts found for the current filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Opening Float</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-espresso">{shift.cashier?.email ?? '—'}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-sand">{shift.cashier?.role.replace(/_/g, ' ') ?? ''}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={shift.status} />
                    </TableCell>
                    <TableCell className="text-sm text-espresso">{formatDateTime(shift.openedAt)}</TableCell>
                    <TableCell className="text-sm text-espresso">{formatDateTime(shift.closedAt)}</TableCell>
                    <TableCell className="font-mono text-sm text-espresso">
                      {formatRupee(shift.openingFloat)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-espresso">
                      {shift._count?.sales ?? 0}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-espresso">
                      {shift.closure?.cashDifference !== undefined && shift.closure?.cashDifference !== null
                        ? formatRupee(shift.closure.cashDifference)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/staff/shifts/${shift.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Details
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/pos/shift-report?shiftId=${shift.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Report
                          </Link>
                        </Button>
                        {shift.status === 'OPEN' && (
                          <Button size="sm" onClick={() => setCloseShiftId(shift.id)}>
                            Close
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </ErrorBoundary>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-sand">
            Page {meta.page} of {meta.totalPages} · {meta.total} shifts
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((currentPage) => currentPage - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((currentPage) => currentPage + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {openShiftFlow && (
        <ShiftOpenModal
          cashierName={sessionData?.user?.email ?? 'Cashier'}
          showOwnerDashboardShortcut={false}
          onOpened={() => {
            setOpenShiftFlow(false);
            refreshAfterShiftAction();
          }}
        />
      )}

      {closeShiftId && (
        <ShiftCloseModal
          shiftId={closeShiftId}
          open={closeShiftId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCloseShiftId(null);
              refreshAfterShiftAction();
            }
          }}
          onSuccess={() => {
            setCloseShiftId(null);
            refreshAfterShiftAction();
          }}
        />
      )}
    </div>
  );
}
