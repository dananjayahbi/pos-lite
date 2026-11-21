'use client';

import Link from 'next/link';

import {
  resolveExpenseAccountLabel,
  type ExpenseAccountLookup,
  type ExpenseAccountRefs,
} from '@/lib/expenses/account-label';

interface ExpenseAccountCellProps {
  expense: ExpenseAccountRefs;
  lookup?: ExpenseAccountLookup | undefined;
  className?: string | undefined;
}

/**
 * ARGUS #399 - one Account label in both the list and the detail dialog.
 * A fund-linked expense shows the fund name and links to the petty-cash page;
 * a direct payment account links to the accounts page. Only a genuinely
 * unlinked expense renders "-".
 */
export function ExpenseAccountCell({
  expense,
  lookup,
  className,
}: ExpenseAccountCellProps) {
  const { label, href } = resolveExpenseAccountLabel(expense, lookup);
  if (!href) {
    return <span className={className}>{label}</span>;
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
