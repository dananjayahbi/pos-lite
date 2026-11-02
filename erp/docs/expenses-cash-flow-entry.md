# Expenses page: Cash Flow entry point

The Expenses page header no longer shows a **Cash Flow** button. The statement
still exists at `/expenses/cash-flow` and is reachable from the payment-accounts
Cash Flow tab / direct navigation, but the Expenses list keeps a single primary
action (Add Expense) plus the petty-cash export.

Removing the button also removes the now-unused `next/link` and `ArrowRight`
imports from `src/app/(store)/expenses/page.tsx`.
