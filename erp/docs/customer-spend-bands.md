# Customer spend bands are non-overlapping

The customer list spend filter described overlapping bands: "Under Rs. 5,000"
sent `spendMax=5000` and "Rs. 5,000 - 25,000" sent `spendMin=5000`, so a customer
who had spent exactly Rs. 5,000 matched both. Switching bands changed the total
by one (44 vs 43) and the same customer appeared twice across the two filters
(ARGUS #312).

## Bands

`CUSTOMER_SPEND_BANDS` in `src/lib/services/customerSpendBands.core.ts` is the
single definition, with inclusive bounds:

| Key                   | Label                  | Range              |
| --------------------- | ---------------------- | ------------------ |
| `ANY`                 | Any                    | unbounded          |
| `UNDER_5000`          | Under Rs. 5,000        | 0 - 4,999.99       |
| `FROM_5000_TO_24999`  | Rs. 5,000 - 24,999.99  | 5,000 - 24,999.99  |
| `FROM_25000`          | Rs. 25,000+            | 25,000 and above   |

`totalSpend` is `Decimal(12, 2)`, so 4,999.99 is the largest value in the first
band and the cut at 25,000 is likewise safe.

The customers page renders its dropdown labels from this list and derives the
`spendMin` / `spendMax` query parameters from the same entry, so the visible
label and the filter can no longer diverge.

## Counts

`countCustomersBySpendBand()` assigns every customer to exactly one bucket and
returns `ANY` as the total; `UNDER_5000 + FROM_5000_TO_24999 + FROM_25000`
always equals `ANY`. Non-numeric spend is skipped rather than counted as zero.

## Verification

`src/lib/services/__tests__/customerSpendBands.core.test.ts` pins both boundary
values (5,000 and 25,000), the values just below each boundary, zero/negative
data, the count partition invariant and unique band keys.
