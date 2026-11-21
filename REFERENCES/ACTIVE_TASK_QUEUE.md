# Active ARGUS task queue (claimed)

All 65 tasks below are claimed by `opencode-deepseek-v4.1-flash`. Atlas is the
source of truth; this checklist exists so none is missed.

Status: **45 submitted to review + merged**, 18 in the current agent batches,
2 blocked by a missing Definition of Done (cannot be submitted by any agent).

## Submitted + merged

Batch 1-3 (single-agent and main work)

- #167 category create/update audit
- #168 category archive-copy fix
- #174 brand description clearing
- #175 brand create/update audit
- #176 brand delete-lock copy/detail
- #183 all 13 movement reasons
- #184 inclusive movement date filters
- #185 stock valuation permission gate
- #186 adjustment audit + webhook
- #187 stock-take counts + maker-checker
- #194 adjustment cache invalidation
- #195 adjustment storefront revalidation
- #199 movement source documents
- #200 movement CSV local timestamps
- #201 movement CSV formula safety
- #227 PO cancel guard
- #228 PO partial payment state
- #229 PO lifecycle audit
- #230 PO order-date filter
- #231 PO payment row lock
- #232 PO legacy totals/receipt repair script
- #234 supplier list error state
- #235 supplier duplicate-name warning
- #248 BOM production lock
- #249 BOM duplicate ingredients
- #250 BOM eligible variants
- #252 BOM error/retry states
- #264 dispatch visible selection
- #265 dispatch bulk failure reporting
- #266 dispatch source/payment/total-to-collect
- #267 dispatch list error state
- #271 delivery detail item lines
- #272 shared confirmed cancel flow
- #273 delivery detail load states
- #274 list print/invoice feedback
- #275 prepare PLACED/HOLD deliveries
- #281 packaging consumption ledger
- #282 packaging shortfall blocks dispatch
- #283 explicit per-dispatch packaging selection
- #284 packaging list error state
- #290 name-based destination-only rate zones
- #311 customer purchase items count units
- #315 customer audit trail
- #317 broadcast no-contact opt-out
- #322 promotions sequential stacking (fix was already merged; task re-submitted)

Checkpoint after this batch: full suite green at **1,912 tests / 230 files**;
`tsc` clean.

## In progress (current agent batches)

| Agent | ARGUS | Task id | State |
| --- | --- | --- | --- |
| supply | #236 supplier phone normalization | `a0aa045a-c029-4de6-b398-a9b9d68a61fc` | assigned |
| supply | #237 supplier audit | `6d573776-d345-4377-a6a9-c8700bceb6be` | assigned |
| supply | #245 raw-material locks/Decimal | `401cb4d6-6cb8-4f9a-8629-c38d35ed921d` | assigned |
| supply | #246 raw-material adjustment reason/history | `1d3e1e59-e573-454a-a1ab-0cfd82730e88` | assigned |
| factory | #253 legacy production batches | `eab0b6ad-5ad3-4963-a3a7-e5c8452ae236` | assigned |
| factory | #256 factory dashboard alert invalidation | `e283fb3a-2823-4ee0-8a9d-15f518da56f4` | assigned |
| factory | #257 factory dashboard auto refresh | `d6634eae-8497-45df-9093-cb09fc91baf4` | assigned |
| inventory | #208 clear stock-take count | `a544671f-f681-4d04-a1fb-59292cd95d72` | assigned |
| inventory | #209 stock-take category validation | `cc7098d7-3587-4b94-82b3-cd903f5e938d` | assigned |
| inventory | #210 stock-take refresh/revalidation | `c98b64ae-df7a-4da5-a62d-cdaada2bcf18` | assigned |
| inventory | #214 low-stock effective threshold | `2b86853e-517c-4b7a-8b2c-f5ed8a3527d5` | assigned |
| inventory | #215 shared low-stock predicate | `9433e200-0fc2-4c3e-b712-a22afe0aed49` | assigned |
| inventory | #218 valuation cost-basis label | `27ad61c0-c358-48e1-9028-3104131a278e` | assigned |
| catalog | #291 rate-card delivery estimate | `beffc1e3-864e-408c-9535-f2225d8a3483` | assigned |
| catalog | #292 no active rate card | `e0b397bf-d358-4669-8acd-20ea1babd6c6` | assigned |
| catalog | #293 rate-card VAT basis | `499fa2b3-91b0-40c2-b6e6-b131a2934cd9` | assigned |
| delivery | #300 waybill address guard | `543601ef-06a5-47ef-a0f4-a51febd55cee` | assigned |
| delivery | #301 waybill sender identity | `0d69ef9c-b3d1-4a23-a75d-9df58440353b` | assigned |

## Blocked (no Definition of Done items)

| Item | Task id | State |
| --- | --- | --- |
| Baseline Prisma migrations (P3005) | `cf45521f-907c-4753-abd6-8124c70d0375` | work done + documented, cannot submit (0 DoD items) |
| Void credit restoration | `86a457ca-453f-4a2c-a172-6e7b1a9233df` | fix merged earlier, cannot submit (0 DoD items) |

## Database

- Live schema diff is empty after applying the 7 never-run additive migrations
  and the `sale_lines` FK action.
- All 54 migrations are baselined with `migrate resolve --applied`; new
  migrations can use `prisma migrate deploy`.
- The DB host occasionally drops connections (P1001); retry commands.

Total: 45 submitted + 18 in progress + 2 blocked = 65.
