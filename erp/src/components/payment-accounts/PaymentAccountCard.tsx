'use client';

import {
  ArrowLeftRight,
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRupee } from '@/lib/format';
import { AccountTypeBadge } from './AccountTypeBadge';
import type { PaymentAccount } from './paymentAccountTypes';

interface PaymentAccountCardProps {
  account: PaymentAccount;
  /** Capability gates (ARGUS #427); defaults keep existing callers working. */
  canEdit?: boolean;
  canTransfer?: boolean;
  canDeposit?: boolean;
  canWithdraw?: boolean;
  canClose?: boolean;
  onEdit: (account: PaymentAccount) => void;
  onOpenBook: (account: PaymentAccount) => void;
  onTransfer: (account: PaymentAccount) => void;
  onDeposit: (account: PaymentAccount) => void;
  onWithdraw: (account: PaymentAccount) => void;
  onClose: (account: PaymentAccount) => void;
}

/**
 * One account row. Money-moving actions disappear for CLOSED accounts because
 * the API rejects them; the book stays reachable so history is never lost.
 */
export function PaymentAccountCard({
  account,
  canEdit = true,
  canTransfer = true,
  canDeposit = true,
  canWithdraw = true,
  canClose = true,
  onEdit,
  onOpenBook,
  onTransfer,
  onDeposit,
  onWithdraw,
  onClose,
}: PaymentAccountCardProps) {
  const isClosed = account.status === 'CLOSED';

  return (
    <div className="rounded-xl border border-mist bg-pearl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-espresso">
              {account.name}
            </h3>
            <AccountTypeBadge type={account.type} />
            {account.pettyCashFundId && (
              <Badge className="border border-green-200 bg-green-50 font-body text-green-700">
                Petty Cash
              </Badge>
            )}
            {isClosed && (
              <Badge className="border border-mist bg-linen font-body text-sand-ink">Closed</Badge>
            )}
          </div>
          {account.accountNumber && (
            <p className="mt-1 font-mono text-xs text-sand-ink">{account.accountNumber}</p>
          )}
          {account.note && (
            <p className="mt-1 max-w-xl truncate font-body text-xs text-mist-ink">{account.note}</p>
          )}
          {account.details && account.details.length > 0 && (
            <dl className="mt-2 flex max-w-xl flex-wrap gap-x-5 gap-y-1 border-t border-mist/50 pt-2">
              {account.details.map((detail, index) => (
                <div key={`${detail.label}-${index}`} className="min-w-0">
                  <dt className="font-body text-[10px] uppercase tracking-wide text-mist-ink">
                    {detail.label || 'Detail'}
                  </dt>
                  <dd className="truncate font-body text-xs text-espresso">
                    {detail.value || '-'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="text-right">
          <p className="font-body text-[11px] uppercase tracking-wide text-mist-ink">Balance</p>
          <p
            className={[
              'font-mono text-lg font-semibold',
              isClosed ? 'text-sand-ink' : 'text-espresso',
            ].join(' ')}
          >
            {formatRupee(account.balance)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-mist/60 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenBook(account)}
          className="font-body text-espresso"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Account Book
        </Button>

        {canEdit && !account.pettyCashFundId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(account)}
            className="font-body text-espresso"
            title={
              isClosed
                ? 'Closed accounts keep their history; identification details can still be corrected.'
                : undefined
            }
          >
            <Pencil className="h-3.5 w-3.5" />
            {isClosed ? 'Edit details' : 'Edit'}
          </Button>
        )}

        {!isClosed && !account.pettyCashFundId && (canTransfer || canDeposit || canWithdraw || canClose) && (
          <>
            {canTransfer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTransfer(account)}
                className="font-body text-espresso"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Fund Transfer
              </Button>
            )}
            {canDeposit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeposit(account)}
                className="font-body text-espresso"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Deposit
              </Button>
            )}
            {canWithdraw && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onWithdraw(account)}
                className="font-body text-espresso"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                Withdraw
              </Button>
            )}
            {canClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onClose(account)}
                className="font-body text-[#9B2226] hover:bg-[#9B2226]/10 hover:text-[#9B2226]"
              >
                <Lock className="h-3.5 w-3.5" />
                Close
              </Button>
            )}
          </>
        )}

        {isClosed && account.closedAt && (
          <span className="ml-auto font-body text-[11px] text-mist-ink">
            Closed {new Date(account.closedAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </div>
    </div>
  );
}
