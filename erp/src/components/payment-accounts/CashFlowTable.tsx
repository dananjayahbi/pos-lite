'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatRupee } from '@/lib/format';
import { AccountTypeBadge } from './AccountTypeBadge';
import { LedgerPagination } from './LedgerPagination';
import { paymentAccountKeys } from './paymentAccountQueryKeys';
import { buildQuery, getJson } from './paymentAccountApi';
import { ENTRY_SOURCE_LABELS, formatEntryDate, parseMoney } from './paymentAccountLabels';
import type { CashFlowResult, PaymentAccount } from './paymentAccountTypes';

const PAGE_SIZE = 25;
const ALL_ACCOUNTS = 'ALL';

interface CashFlowTableProps {
  accounts: PaymentAccount[];
}

/**
 * Tenant-wide ledger: every entry across every account for a chosen window.
 * The Account column is what distinguishes it from a single account book.
 */
export function CashFlowTable({ accounts }: CashFlowTableProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [accountId, setAccountId] = useState<string>(ALL_ACCOUNTS);
  const [page, setPage] = useState(1);

  const filters = { dateFrom, dateTo, accountId, page };

  const { data, isLoading, isError, error } = useQuery<CashFlowResult>({
    queryKey: paymentAccountKeys.cashFlow(filters),
    queryFn: () =>
      getJson<CashFlowResult>(
        `/api/store/payment-accounts/cash-flow${buildQuery({
          dateFrom,
          dateTo,
          accountId: accountId === ALL_ACCOUNTS ? undefined : accountId,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
  });

  const entries = data?.entries ?? [];
  const sums = data?.sums ?? { debit: 0, credit: 0 };
  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="cashflow-date-from" className="font-body text-xs text-sand">
            From
          </Label>
          <Input
            id="cashflow-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              resetPage();
            }}
            className="mt-1 w-40 border-mist"
          />
        </div>
        <div>
          <Label htmlFor="cashflow-date-to" className="font-body text-xs text-sand">
            To
          </Label>
          <Input
            id="cashflow-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              resetPage();
            }}
            className="mt-1 w-40 border-mist"
          />
        </div>
        <div>
          <Label htmlFor="cashflow-account" className="font-body text-xs text-sand">
            Account
          </Label>
          <Select
            value={accountId}
            onValueChange={(next) => {
              setAccountId(next);
              resetPage();
            }}
          >
            <SelectTrigger id="cashflow-account" className="mt-1 w-56 border-mist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACCOUNTS}>All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="font-body text-sm text-[#9B2226]">
          {error instanceof Error ? error.message : 'Could not load the cash flow'}
        </p>
      ) : (
        <div className="rounded-lg border border-mist bg-pearl">
          <Table>
            <TableHeader>
              <TableRow className="bg-linen/40">
                <TableHead className="text-espresso">Date</TableHead>
                <TableHead className="text-espresso">Account</TableHead>
                <TableHead className="text-espresso">Description</TableHead>
                <TableHead className="text-espresso">Source</TableHead>
                <TableHead className="text-right text-espresso">Debit</TableHead>
                <TableHead className="text-right text-espresso">Credit</TableHead>
                <TableHead className="text-right text-espresso">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center font-body text-sand">
                    No ledger entries for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-linen/20">
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {formatEntryDate(entry.entryDate)}
                    </TableCell>
                    <TableCell>
                      {entry.account ? (
                        <div className="flex items-center gap-2">
                          <span className="font-body text-sm text-espresso">
                            {entry.account.name}
                          </span>
                          <AccountTypeBadge type={entry.account.type} />
                        </div>
                      ) : (
                        <span className="font-body text-xs text-mist">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-body">
                      {entry.description}
                    </TableCell>
                    <TableCell className="font-body text-xs text-sand">
                      {ENTRY_SOURCE_LABELS[entry.source]}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {parseMoney(entry.debit) === 0 ? '—' : formatRupee(entry.debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {parseMoney(entry.credit) === 0 ? '—' : formatRupee(entry.credit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-espresso">
                      {formatRupee(entry.balanceAfter)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="flex justify-end">
            <div className="rounded-lg border border-mist bg-linen/30 px-4 py-2">
              <div className="flex flex-wrap items-center gap-6 font-body text-sm">
                <span className="text-sand">
                  Total debit:{' '}
                  <span className="font-mono text-espresso">{formatRupee(sums.debit)}</span>
                </span>
                <span className="text-sand">
                  Total credit:{' '}
                  <span className="font-mono text-espresso">{formatRupee(sums.credit)}</span>
                </span>
                <span className="text-sand">
                  Net:{' '}
                  <span className="font-mono font-semibold text-espresso">
                    {formatRupee(sums.debit - sums.credit)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {data && (
            <LedgerPagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
