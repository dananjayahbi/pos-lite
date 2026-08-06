# Website Module — Deep Audit

Date: 2026-08-06
Audited scope: `erp/` (settings/website module, website API, public storefront API, schema) and `website/` (customer-facing storefront, fetch/cache/revalidation).

## Purpose
The ERP's **Website Configuration** screen (`/settings/website`) had reports of:
1. Many sync issues between the ERP and the customer-facing website.
2. Several configuration sections not updating properly after saving.
3. A need to confirm end-to-end correctness at production level.

This audit identifies the root causes. It is **diagnosis only** — no fixes are applied here.

## Document map
| Document | Covers |
|---|---|
| [01-critical-data-loss-and-deployment.md](./01-critical-data-loss-and-deployment.md) | The most urgent bugs: hero-slide edits silently lost, broken Reset, missing DB migrations. |
| [02-sync-gaps-between-erp-and-website.md](./02-sync-gaps-between-erp-and-website.md) | Revalidation coverage gaps: category counts, stock after orders, partial-failure reporting, ISR inconsistency. |
| [03-config-schema-robustness-and-dead-code.md](./03-config-schema-robustness-and-dead-code.md) | Loose config validation, load/save mismatch, default-merge risk, orphaned/dead components, preview shell gaps. |

## Severity summary
| Severity | Count | Notes |
|---|---|---|
| Critical | 3 | Hero slides lost on save; Reset button broken; website tables missing from migrations. |
| High | 1 | Stock/revalidation not triggered after storefront orders. |
| Medium | 5 | Category counts stale; revalidate false-success; checkout ISR; load/save mismatch; preview shell gaps. |
| Low / Info | 6 | Loose validation; default-merge risk; dead code; mixed URL scheme; unused import; seed gap. |

## How to use this
Each finding lists a **symptom**, a **root cause** (file reference, no code), **impact**, **severity**, and a **recommended fix direction**. Review in severity order before planning implementation.
