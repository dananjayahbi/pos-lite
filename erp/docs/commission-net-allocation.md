# Commission net allocation and receipt reconciliation (ARGUS #366)

## Problem

A partial payout walked only positive outstanding records oldest-first. Negative
return adjustments stayed open until a full payout, so per-record paid state and
the payout receipt did not visibly tie to the net liability. A user paying
Rs 500 against +Rs 1,000 and -Rs 100 saw a receipt for Rs 500, a positive record
part-paid, and a negative record untouched with no explanation.

## Net allocation rule

`src/lib/services/commission-allocation.ts` now owns one documented model:

1. **Settle negative adjustments first.** Each open negative record is settled
   to `paidAmount = earnedAmount`; this uses no cash but reduces what the
   positive records owe.
2. **Allocate the cash plus the netted adjustments to positive records**,
   oldest-first.
3. Algebraically:

```
adjustmentCapacity = sum(abs(negative outstanding))
grossAllocated     = cash payment + adjustmentCapacity
netAllocated       = grossAllocated - adjustmentCapacity = cash payment
```

The sum of every record's `paidAmount` change equals the cash payout, and the
remaining net liability is `netOutstanding - cash payment` as before.

Example: +1,000 and -100, paying 500:

| Record | Before | After | This payout |
| --- | --- | --- | --- |
| Sale +1,000 | paid 0 | paid 600 | +600 |
| Return -100 | paid 0 | paid -100 (settled) | -100 |
| Net | 900 open | 400 open | 500 cash |

## Receipt

`summarizeCommissionAllocation(records, allocations)` returns
`recordCount`, `grossAllocated`, `adjustmentsSettled` and `netAllocated`. It is
pure and unit tested. `createCommissionPayout` stores that summary inside the
payout's existing `notes` JSON (no schema change), and `getCommissionPayouts`
returns it as `allocation`. The receipt dialog shows:

- Gross commission settled
- Less return adjustments
- Net paid across N records

Legacy payouts without the summary simply omit the block; their amount and
period still render.

## Tests

- partial payout with a negative adjustment settles the negative and allocates
  the cash plus netting to the positive record;
- full payout settles every record and the net equals cash;
- a fully netted (zero/negative) balance refuses allocation;
- the allocation summary reconciles gross, adjustments and net.

No schema, migration, package or lock change is involved.
