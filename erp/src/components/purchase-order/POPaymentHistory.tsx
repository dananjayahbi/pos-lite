'use client';

import { CheckCircle2, History } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRupee } from '@/lib/format';

import { formatPoDate } from './poDates';
import type { POPayment } from './poTypes';

/**
 * Paid / outstanding / settled roll-up and the payment rows themselves.
 *
 * Presentational only — the parent owns the query so the "Record Payment"
 * dialog and this panel read the same figures.
 */
interface POPaymentHistoryProps {
  payments: POPayment[];
  payable: number;
  paidTotal: number;
  outstanding: number;
  settled: boolean;
  isLoading?: boolean;
}

export function POPaymentHistory({
  payments,
  payable,
  paidTotal,
  outstanding,
  settled,
  isLoading,
}: POPaymentHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-terracotta" />
          Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-sand/30 bg-linen/50 px-3 py-2">
            <p className="text-xs text-mist">Payable</p>
            <p className="font-mono text-sm text-espresso">{formatRupee(payable)}</p>
          </div>
          <div className="rounded-lg border border-sand/30 bg-linen/50 px-3 py-2">
            <p className="text-xs text-mist">Paid</p>
            <p className="font-mono text-sm text-green-700">{formatRupee(paidTotal)}</p>
          </div>
          <div className="rounded-lg border border-sand/30 bg-linen/50 px-3 py-2">
            <p className="text-xs text-mist">Outstanding</p>
            <p
              className={`font-mono text-sm ${outstanding > 0 ? 'text-amber-700' : 'text-espresso'}`}
            >
              {formatRupee(outstanding)}
            </p>
          </div>
        </div>

        {settled ? (
          <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Settled in full.
          </p>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : payments.length === 0 ? (
          <p className="py-3 text-sm text-mist">
            No payments recorded yet. Use “Record Payment” to settle from a payment account.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-sand/30">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid on</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatPoDate(payment.paidAt)}</TableCell>
                    <TableCell>{payment.account?.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{payment.reference ?? '—'}</TableCell>
                    <TableCell className="max-w-[18rem] truncate">{payment.note ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRupee(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
