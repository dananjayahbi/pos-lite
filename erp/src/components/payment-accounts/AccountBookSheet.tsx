'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import {
  ENTRY_SOURCE_LABELS,
  formatEntryDate,
  parseMoney,
} from './paymentAccountLabels';
import { PAYMENT_ENTRY_SOURCES } from './paymentAccountTypes';
import type {
  AccountBookResult,
  PaymentAccount,
  PaymentEntrySource,
} from './paymentAccountTypes';

const PAGE_SIZE = 25;
const ALL_SOURCES = 'ALL';

interface AccountBookSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The account whose ledger is shown; `null` while the sheet is closed. */
  account: PaymentAccount | null;
}

export function AccountBookSheet({ open, onOpenChange, account }: AccountBookSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-l border-mist bg-pearl sm:max-w-4xl">
        {account && <BookBody account={account} />}
      </SheetContent>
    </Sheet>
  );
}

function BookBody({ account }: { account: PaymentAccount }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [source, setSource] = useState<PaymentEntrySource | typeof ALL_SOURCES>(ALL_SOURCES);
  const [page, setPage] = useState(1);

  const filters = {
    accountId: account.id,
    dateFrom,
    dateTo,
    source,
    page,
  };

  const { data, isLoading, isError, error } = useQuery<AccountBookResult>({
    queryKey: paymentAccountKeys.book(filters),
    queryFn: () =>
      getJson<AccountBookResult>(
        `/api/store/payment-accounts/${account.id}/book${buildQuery({
          dateFrom,
          dateTo,
          source: source === ALL_SOURCES ? undefined : source,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
  });

  const header = data?.account ?? account;
  const entries = data?.entries ?? [];
  const sums = data?.sums ?? { debit: 0, credit: 0 };

  const resetPage = () => setPage(1);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="gap-1 border-b border-mist bg-linen/40 p-4">
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <SheetTitle className="font-display text-lg text-espresso">{header.name}</SheetTitle>
          <AccountTypeBadge type={header.type} />
          {header.status === 'CLOSED' && (
            <Badge className="border border-mist bg-pearl font-body text-sand">Closed</Badge>
          )}
        </div>
        <SheetDescription className="font-body text-xs text-sand">
          {header.accountNumber ? (
            <span className="font-mono">{header.accountNumber}</span>
          ) : (
            'Account book — every ledger entry for this account.'
          )}
        </SheetDescription>
        <p className="font-body text-sm text-sand">
          Balance:{' '}
          <span className="font-mono text-base font-semibold text-espresso">
            {formatRupee(header.balance)}
          </span>
        </p>
      </SheetHeader>

      <div className="flex flex-wrap items-end gap-3 border-b border-mist p-4">
        <div>
          <Label htmlFor="book-date-from" className="font-body text-xs text-sand">
            From
          </Label>
          <Input
            id="book-date-from"
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
          <Label htmlFor="book-date-to" className="font-body text-xs text-sand">
            To
          </Label>
          <Input
            id="book-date-to"
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
          <Label htmlFor="book-source" className="font-body text-xs text-sand">
            Source
          </Label>
          <Select
            value={source}
            onValueChange={(next) => {
              setSource(next as PaymentEntrySource | typeof ALL_SOURCES);
              resetPage();
            }}
          >
            <SelectTrigger id="book-source" className="mt-1 w-52 border-mist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SOURCES}>All sources</SelectItem>
              {PAYMENT_ENTRY_SOURCES.map((option) => (
                <SelectItem key={option} value={option}>
                  {ENTRY_SOURCE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="font-body text-sm text-[#9B2226]">
            {error instanceof Error ? error.message : 'Could not load the account book'}
          </p>
        ) : (
          <div className="rounded-lg border border-mist bg-pearl">
            <Table>
              <TableHeader>
                <TableRow className="bg-linen/40">
                  <TableHead className="text-espresso">Date</TableHead>
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
                    <TableCell colSpan={6} className="py-8 text-center font-body text-sand">
                      No entries for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-linen/20">
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {formatEntryDate(entry.entryDate)}
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
          <div className="mt-3 rounded-lg border border-mist bg-linen/30 px-4 py-2">
            <div className="flex flex-wrap items-center justify-end gap-6 font-body text-sm">
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
        )}

        {!isLoading && !isError && data && (
          <div className="mt-3">
            <LedgerPagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
