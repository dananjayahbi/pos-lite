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
            {isClosed && (
              <Badge className="border border-mist bg-linen font-body text-sand">Closed</Badge>
            )}
          </div>
          {account.accountNumber && (
            <p className="mt-1 font-mono text-xs text-sand">{account.accountNumber}</p>
          )}
          {account.note && (
            <p className="mt-1 max-w-xl truncate font-body text-xs text-mist">{account.note}</p>
          )}
        </div>

        <div className="text-right">
          <p className="font-body text-[11px] uppercase tracking-wide text-mist">Balance</p>
          <p
            className={[
              'font-mono text-lg font-semibold',
              isClosed ? 'text-sand' : 'text-espresso',
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

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(account)}
          className="font-body text-espresso"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>

        {!isClosed && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTransfer(account)}
              className="font-body text-espresso"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Fund Transfer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeposit(account)}
              className="font-body text-espresso"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Deposit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onWithdraw(account)}
              className="font-body text-espresso"
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Withdraw
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClose(account)}
              className="font-body text-[#9B2226] hover:bg-[#9B2226]/10 hover:text-[#9B2226]"
            >
              <Lock className="h-3.5 w-3.5" />
              Close
            </Button>
          </>
        )}

        {isClosed && account.closedAt && (
          <span className="ml-auto font-body text-[11px] text-mist">
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
