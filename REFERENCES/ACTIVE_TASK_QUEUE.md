# Active ARGUS task queue (claimed)

All 65 tasks below are claimed by `opencode-deepseek-v4.1-flash`. Atlas is the
source of truth; this checklist exists so none is missed.

Status: **57 submitted to review + merged**, 6 in the final inventory batch,
2 blocked by a missing Definition of Done (cannot be submitted by any agent).

## Submitted + merged

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
- #236 supplier phone normalization
- #237 supplier audit trail
- #245 raw-material locks and Decimal
- #246 raw-material reason/history
- #248 BOM production lock
- #249 BOM duplicate ingredients
- #250 BOM eligible variants
- #252 BOM error/retry states
- #253 legacy production batch repair
- #256 factory dashboard alert invalidation
- #257 factory dashboard auto-refresh
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
- #291 rate preview district/staleness
- #292 missing rate card is unconfigured, not free
- #293 VAT on service fees
- #300 waybill recipient guard
- #301 waybill sender identity
- #311 customer purchase items count units
- #315 customer audit trail
- #317 broadcast no-contact opt-out
- #322 promotions sequential stacking (already merged; re-submitted)

Checkpoint after this batch: **2,008 tests / 242 files**, `tsc` clean.

## Final inventory batch (agent-reports)

| ARGUS | Task id | State |
| --- | --- | --- |
| #208 clear stock-take count | `a544671f-f681-4d04-a1fb-59292cd95d72` | assigned |
| #209 stock-take category validation | `cc7098d7-3587-4b94-82b3-cd903f5e938d` | assigned |
| #210 stock-take refresh/revalidation | `c98b64ae-df7a-4da5-a62d-cdaada2bcf18` | assigned |
| #214 low-stock effective threshold | `2b86853e-517c-4b7a-8b2c-f5ed8a3527d5` | assigned |
| #215 shared low-stock predicate | `9433e200-0fc2-4c3e-b712-a22afe0aed49` | assigned |
| #218 valuation cost-basis label | `27ad61c0-c358-48e1-9028-3104131a278e` | assigned |

Note: the inventory batch above is the last one; nothing else is unassigned.

## Blocked (no Definition of Done items)

| Item | Task id | State |
| --- | --- | --- |
| Baseline Prisma migrations (P3005) | `cf45521f-907c-4753-abd6-8124c70d0375` | **done**: schema diff empty, 54/54 baselined, `migrate status` says up to date; cannot submit (0 DoD items) |
| Void credit restoration | `86a457ca-453f-4a2c-a172-6e7b1a9233df` | fix merged earlier, cannot submit (0 DoD items) |

## Database

- `prisma migrate status`: **Database schema is up to date!**
- Live schema diff: empty migration.
- New migrations can use `prisma migrate deploy`; do not reset the live DB.

## Proposed for triage (not claimed)

- Reports > Stock Movements still uses the old 11-reason list.
- Seed creates demo POs without subtotal/receipt movements.
- Soft-deleted BOMs cannot be restored/recreated.
- Dispatch uploads to the courier before the DB transaction.
