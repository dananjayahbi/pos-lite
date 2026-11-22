import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { resolveExpensePageAccess } from '@/lib/expenses/access';
import { resolveExpenseApprovalThreshold } from '@/lib/expenses/approval-policy';
import ExpensesPageClient from './ExpensesPageClient';

export const metadata = { title: 'Expenses | AyurPOS' };

/**
 * ARGUS #398 - the Expenses page is server-gated on `expense:view`, matching
 * its APIs. The client shell (Add Expense, Export, edit controls) only renders
 * for an actor who may actually use those actions.
 *
 * ARGUS #407 - `?fundId=` carries the petty-cash fund from the fund page so the
 * create form opens preselected instead of losing the link.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ fundId?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.tenantId) redirect(denialRouteFor(session.user));

  const access = resolveExpensePageAccess(session.user);
  if (!access.canView) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const initialFundId =
    typeof params.fundId === 'string' && params.fundId.length > 0 ? params.fundId : null;

  return (
    <ExpensesPageClient
      canCreate={access.canCreate}
      canApprove={access.canApprove}
      approvalThreshold={resolveExpenseApprovalThreshold()}
      initialFundId={initialFundId}
    />
  );
}
