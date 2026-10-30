'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRupee } from '@/lib/format';
import { PaymentAccountCard } from './PaymentAccountCard';
import { CreateAccountDialog } from './CreateAccountDialog';
import { FundTransferDialog } from './FundTransferDialog';
import { DepositDialog } from './DepositDialog';
import { WithdrawDialog } from './WithdrawDialog';
import { CloseAccountDialog } from './CloseAccountDialog';
import { AccountBookSheet } from './AccountBookSheet';
import { CashFlowTable } from './CashFlowTable';
import { paymentAccountKeys } from './paymentAccountQueryKeys';
import { getJson, sendJson } from './paymentAccountApi';
import { parseMoney } from './paymentAccountLabels';
import type {
  ClosePayload,
  CreateAccountPayload,
  DepositPayload,
  PaymentAccount,
  PaymentAccountListResult,
  TransferPayload,
  UpdateAccountPayload,
  WithdrawalPayload,
} from './paymentAccountTypes';

/**
 * Which dialog is open, and for which account. A single discriminated value
 * keeps the six dialogs from needing six booleans that can disagree.
 */
type ActiveDialog =
  | { kind: 'create' }
  | { kind: 'edit'; account: PaymentAccount }
  | { kind: 'transfer'; account: PaymentAccount }
  | { kind: 'deposit'; account: PaymentAccount }
  | { kind: 'withdraw'; account: PaymentAccount }
  | { kind: 'close'; account: PaymentAccount }
  | null;

export function PaymentAccountsPageClient() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [bookAccount, setBookAccount] = useState<PaymentAccount | null>(null);

  const accountsQuery = useQuery<PaymentAccountListResult>({
    queryKey: paymentAccountKeys.list(),
    queryFn: () => getJson<PaymentAccountListResult>('/api/store/payment-accounts'),
  });

  const accounts = accountsQuery.data?.accounts ?? [];
  const totalBalance = accountsQuery.data?.totalBalance ?? 0;
  const activeCount = accounts.filter((account) => account.status === 'ACTIVE').length;

  /** Any money movement changes balances, books and the cash-flow view. */
  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: paymentAccountKeys.all });
  };

  const closeDialog = () => setDialog(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateAccountPayload) =>
      sendJson<PaymentAccount>('/api/store/payment-accounts', 'POST', payload),
    onSuccess: async (account) => {
      await invalidateAll();
      toast.success(`Account created — ${account.name}`);
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAccountPayload }) =>
      sendJson<PaymentAccount>(`/api/store/payment-accounts/${id}`, 'PATCH', payload),
    onSuccess: async (account) => {
      await invalidateAll();
      toast.success(`Account updated — ${account.name}`);
      closeDialog();
    },
  });

  const transferMutation = useMutation({
    mutationFn: (payload: TransferPayload) =>
      sendJson('/api/store/payment-accounts/transfer', 'POST', payload),
    onSuccess: async () => {
      await invalidateAll();
      toast.success('Fund transfer recorded');
      closeDialog();
    },
  });

  const depositMutation = useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: DepositPayload }) =>
      sendJson(`/api/store/payment-accounts/${accountId}/deposit`, 'POST', payload),
    onSuccess: async () => {
      await invalidateAll();
      toast.success('Deposit recorded');
      closeDialog();
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: WithdrawalPayload }) =>
      sendJson(`/api/store/payment-accounts/${accountId}/withdraw`, 'POST', payload),
    onSuccess: async () => {
      await invalidateAll();
      toast.success('Withdrawal recorded');
      closeDialog();
    },
  });

  const closeAccountMutation = useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: ClosePayload }) =>
      sendJson(`/api/store/payment-accounts/${accountId}/close`, 'POST', payload),
    onSuccess: async () => {
      await invalidateAll();
      toast.success('Account closed');
      closeDialog();
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Payment Accounts</h1>
          <p className="mt-1 font-body text-sm text-sand">
            Every rupee that moves through the business passes through one of these accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-mist font-body text-espresso"
            onClick={() => {
              void accountsQuery.refetch();
            }}
            disabled={accountsQuery.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${accountsQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            className="bg-espresso font-body text-pearl hover:bg-espresso/90"
            onClick={() => setDialog({ kind: 'create' })}
          >
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-mist/30 bg-pearl p-4">
          <p className="font-body text-xs uppercase tracking-wide text-mist">Total balance</p>
          <p className="mt-2 font-display text-2xl text-espresso">{formatRupee(totalBalance)}</p>
          <p className="mt-1 font-body text-xs text-sand">Across active accounts</p>
        </div>
        <div className="rounded-xl border border-mist/30 bg-pearl p-4">
          <p className="font-body text-xs uppercase tracking-wide text-mist">Active accounts</p>
          <p className="mt-2 font-display text-2xl text-espresso">{activeCount}</p>
          <p className="mt-1 font-body text-xs text-sand">
            {accounts.length - activeCount} closed
          </p>
        </div>
        <div className="rounded-xl border border-mist/30 bg-pearl p-4">
          <p className="font-body text-xs uppercase tracking-wide text-mist">Highest balance</p>
          <p className="mt-2 font-display text-2xl text-espresso">
            {formatRupee(
              accounts.reduce(
                (max, account) => Math.max(max, parseMoney(account.balance) ?? 0),
                0,
              ),
            )}
          </p>
          <p className="mt-1 font-body text-xs text-sand">Single account</p>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="gap-4">
        <TabsList>
          <TabsTrigger value="accounts" className="font-body px-3">
            Accounts
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="font-body px-3">
            Cash Flow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-3">
          {accountsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
          ) : accountsQuery.isError ? (
            <p className="font-body text-sm text-[#9B2226]">
              {accountsQuery.error instanceof Error
                ? accountsQuery.error.message
                : 'Could not load payment accounts'}
            </p>
          ) : accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-mist bg-pearl p-10 text-center">
              <Wallet className="mx-auto h-8 w-8 text-mist" />
              <p className="mt-3 font-display text-base text-espresso">No accounts yet</p>
              <p className="mt-1 font-body text-sm text-sand">
                Add your cash drawer, bank account or payment gateway to start tracking money.
              </p>
              <Button
                className="mt-4 bg-espresso font-body text-pearl hover:bg-espresso/90"
                onClick={() => setDialog({ kind: 'create' })}
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </div>
          ) : (
            accounts.map((account) => (
              <PaymentAccountCard
                key={account.id}
                account={account}
                onEdit={(target) => setDialog({ kind: 'edit', account: target })}
                onOpenBook={(target) => setBookAccount(target)}
                onTransfer={(target) => setDialog({ kind: 'transfer', account: target })}
                onDeposit={(target) => setDialog({ kind: 'deposit', account: target })}
                onWithdraw={(target) => setDialog({ kind: 'withdraw', account: target })}
                onClose={(target) => setDialog({ kind: 'close', account: target })}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="cash-flow">
          <CashFlowTable accounts={accounts} />
        </TabsContent>
      </Tabs>

      <CreateAccountDialog
        open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        {...(dialog?.kind === 'edit' ? { account: dialog.account } : {})}
        onCreate={(payload) => createMutation.mutateAsync(payload).then(() => undefined)}
        onUpdate={(payload) => {
          if (dialog?.kind !== 'edit') return Promise.reject(new Error('No account selected'));
          return updateMutation
            .mutateAsync({ id: dialog.account.id, payload })
            .then(() => undefined);
        }}
      />

      <FundTransferDialog
        open={dialog?.kind === 'transfer'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        accounts={accounts}
        {...(dialog?.kind === 'transfer' ? { defaultFromAccountId: dialog.account.id } : {})}
        onSubmit={(payload) => transferMutation.mutateAsync(payload).then(() => undefined)}
      />

      <DepositDialog
        open={dialog?.kind === 'deposit'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        accounts={accounts}
        account={dialog?.kind === 'deposit' ? dialog.account : null}
        onSubmit={(payload) => {
          if (dialog?.kind !== 'deposit') return Promise.reject(new Error('No account selected'));
          return depositMutation
            .mutateAsync({ accountId: dialog.account.id, payload })
            .then(() => undefined);
        }}
      />

      <WithdrawDialog
        open={dialog?.kind === 'withdraw'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        accounts={accounts}
        account={dialog?.kind === 'withdraw' ? dialog.account : null}
        onSubmit={(payload) => {
          if (dialog?.kind !== 'withdraw') return Promise.reject(new Error('No account selected'));
          return withdrawMutation
            .mutateAsync({ accountId: dialog.account.id, payload })
            .then(() => undefined);
        }}
      />

      <CloseAccountDialog
        open={dialog?.kind === 'close'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        accounts={accounts}
        account={dialog?.kind === 'close' ? dialog.account : null}
        onSubmit={(payload) => {
          if (dialog?.kind !== 'close') return Promise.reject(new Error('No account selected'));
          return closeAccountMutation
            .mutateAsync({ accountId: dialog.account.id, payload })
            .then(() => undefined);
        }}
      />

      <AccountBookSheet
        open={bookAccount !== null}
        onOpenChange={(open) => {
          if (!open) setBookAccount(null);
        }}
        account={bookAccount}
      />
    </div>
  );
}
