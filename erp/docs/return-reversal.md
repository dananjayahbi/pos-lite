# Reversing a completed return

Refunds previously had no reversal path: the reason was optional and a completed
return could not be cancelled or voided, so a mistyped refund needed database
surgery (ARGUS #102).

## Rules

- **Reason required**: `ReturnCreateSchema.reason` is now mandatory (trimmed,
  5-200 chars). The return sheet already renders the field.
- **Controlled reversal**: `POST /api/store/returns/[id]/cancel` (owner/manager
  with `sale:refund`, reason required) marks a completed return `CANCELLED` after
  it:
  1. removes the units the return restocked (stock may not go negative; the
     reversal fails atomically if it would);
  2. recovers store credit from the customer balance (blocked if already spent);
  3. reverses the cash/card refund ledger entry so account balances and cash
     flow no longer include the cancelled refund;
  4. refuses if the exchange credit was already used on another sale.
- The return rows stay for audit; `CANCELLED` returns are excluded from
  completed-sale reports and from the original sale's returnable quantity, so the
  goods can be returned correctly later.
- The Return detail modal shows **Reverse return** for managers, with a required
  reason and a confirmation dialog.

`validateReturnCancellation` (`returnCancellation.core.ts`) holds the pure guard
rules and is unit-tested.

## Not automatic

Commission clawback written when the return was processed is **not**
automatically restored; the operator must review the commission ledger after a
reversal. The audit row `RETURN_CANCELLED` records the reason and amount.
