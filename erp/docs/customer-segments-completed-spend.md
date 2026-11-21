# Marketing segments and exports use completed purchases

Broadcast audiences and the contact export no longer read
`Customer.totalSpend` / `lastPurchaseAt` / `_count.sales` directly (ARGUS #309).
Those fields include voided sales and seeded values: a min-spend of Rs 15,000
returned 11 customers with zero completed sales, and the export's REPEAT scope
counted voided sales, while ACTIVE trusted a `lastPurchaseAt` set by a voided
sale.

## Source of truth

`getCompletedSpendByCustomer()` (`src/lib/services/customerSpend.service.ts`)
groups `Sale` by customer with:

- `status = COMPLETED`
- `completedAt` not null
- `_sum.totalAmount` -> spend
- `_count` -> order count
- `_max.completedAt` -> last purchase

A customer with no completed sale is zero spend / zero orders / no last purchase.

`matchesCompletedSpendRange` and `filterCustomerIdsBySpend`
(`customerSpend.core.ts`) apply the composer's min/max filters to that data.

## Applied to

| Surface                          | Behaviour                                                        |
| -------------------------------- | ---------------------------------------------------------------- |
| Broadcast count (`/api/customers/count`) | spend filters resolve matching customer ids from completed sales |
| Broadcast preview (`/api/customers/preview`) | same filter; displayed `totalSpend` is the completed figure |
| Broadcast send (store + legacy WhatsApp routes) | recipients filtered by completed spend, not the stored column |
| Contact export                   | `totalSpend`, `orderCount`, `lastPurchaseAt` and REPEAT/ACTIVE scopes use completed sales |

Other filters (tags, gender, birthday, channel reachability) are unchanged. The
customer list/detail pages still show the denormalised lifetime column; this
change is scoped to marketing segments and exports.

## Verification

`src/lib/services/__tests__/customerSpend.core.test.ts` covers the inclusive
range, zero-spend exclusion and open-ended segments; the existing contact-export
tests still pass.
