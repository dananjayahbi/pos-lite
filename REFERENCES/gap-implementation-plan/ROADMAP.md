# Implementation Roadmap — Session Grouping

**Purpose:** Groups the [gap-implementation-plan](./README.md) documents into **implementation sessions** ordered by dependency and business priority. Each session contains **1–3 documents** (fewer for complex, schema-heavy tasks).

**Rules:**
- Each session = one focused work unit (≤3 plan documents).
- Schema/model changes are grouped with their dependent features in the same or adjacent sessions.
- Sessions are ordered so that data-model foundations land before the features that consume them.
- Every session is independently shippable and should end with ERP + website typechecks passing.

---

## Legend
- 🔴 Critical priority · 🟠 High · 🟡 Medium
- **Schema:** whether the session changes `prisma/schema.prisma` (requires migration + generate + DB apply)

---

## Phase 0 — Foundations (schema + payments + cart/invoice)

### Session 1 — Product content fields 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 01 | Product Detail Health-Content Fields |

Single, schema-heavy session — add the four health-content fields to `Product`, wire through ERP forms → public API → website detail page. Kept alone because it touches schema + 3 layers.

### Session 2 — E-commerce search & filtering 🟠 · Schema: no
| Doc | Title |
|-----|-------|
| 02 | Shop Price-Range Filter |
| 03 | Health-Concern Taxonomy & Filter |
| 04 | Shop Product-Type / Form Filter |
| 05 | Sitewide Product Search |

⚠️ **4 docs** — allowed as an exception because 02/04/05 all share the same public-products API and `ShopFilters` component. If too large, split off **05** into its own session. All extend the products list API + shop filters.

### Session 3 — Online payments & order lifecycle 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 07 | Online Payment Gateway for Customer Orders |

Schema-heavy (payment fields on order model) + external PayHere integration. Kept alone — high risk, needs dedicated focus.

### Session 4 — Customer order tracking 🔴 · Schema: no
| Doc | Title |
|-----|-------|
| 08 | Public Order Tracking Portal |
| 09 | Customer-Facing Delivery Status |

Pair — 09 depends on 08's lookup surface; both read the existing `DeliveryStatus`/`DeliveryEvent` pipeline. No schema change (read-only exposure).

---

## Phase 1 — Reconciliation & Courier Completion (Modules 3, 4)

### Session 5 — Multi-provider courier architecture 🟠 · Schema: yes
| Doc | Title |
|-----|-------|
| 10 | Multi-Provider Courier Abstraction |

Schema touch (`CarrierProvider` gains values). Architectural refactor of the courier adapter interface — kept alone.

### Session 6 — Checkout fee wiring 🟠 · Schema: no
| Doc | Title |
|-----|-------|
| 11 | Wire Delivery-Fee Calculation into Website Checkout |

Activates existing `calculateShippingFee` in the website order path. Depends on Session 3 (payment) for combined order totals.

### Session 7 — Remittance import completeness 🟠 · Schema: yes
| Doc | Title |
|-----|-------|
| 12 | Excel Remittance Import (.xlsx) |
| 13 | OrderRef Matching Fallback |
| 14 | Discrepancy Sub-Categorization |

Shared reconciliation service + schema additions (discrepancy category). Grouped for a single reconciliation engine pass.

### Session 8 — Payout accuracy & disputes 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 15 | Net Profit Calculation Wiring |
| 16 | Financial Accuracy / Contract-Deduction Audit |
| 17 | Dispute Flagging Engine |

Schema additions (net-payout + dispute records). Completes the Module 4 payout engine.

---

## Phase 2 — CRM, Loyalty & Contact Export (Modules 5, 6)

### Session 9 — Loyalty & repeat-customer CRM 🟠 · Schema: optional
| Doc | Title |
|-----|-------|
| 19 | Loyalty & Repeat-Customer Badges |
| 20 | Repeat Buyers Tab / Filter |
| 21 | Customer Value Metrics |

All derive from `_count.sales` + `SaleLine` aggregation. Optional `lastPurchaseAt` field. Grouped as one CRM analytics pass.

### Session 10 — Customer contact export 🟡 · Schema: no
| Doc | Title |
|-----|-------|
| 18 | Automated Customer Contact Export |

Standalone scheduled-export job + destination config. No schema change.

---

## Phase 3 — Factory, Raw Materials & Traded Goods (Modules 8, 9)

### Session 11 — Factory data model foundation 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 24 | Raw Material Inventory (L/Kg) |
| 25 | Factory Manager Role & Dashboard |

Schema-heavy: new `RawMaterial` + `Unit` enum + `FACTORY_MANAGER` role + permission keys + dashboard. Grouped because the dashboard is meaningless without raw materials.

### Session 12 — BOM & production auto-deduction 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 26 | Bill of Materials & Auto-Deduction |
| 27 | Raw Material Critical-Stock Alerts |

Schema-heavy: `BillOfMaterials` model + new stock-movement reason. 27 depends on 26's raw-material deduction path.

### Session 13 — Traded goods distinction 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 28 | Product Source (Manufactured / Traded) |

Adds `productSource`; gates BOM/production for traded goods. Depends on 26. Kept alone — schema + product wizard.

### Session 14 — Batch & expiry control 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 29 | Batch Numbering & Expiry Tracking |
| 30 | Batch/Expiry Sales Visibility & Alerts |

Schema-heavy: `BatchTracking` + batch/expiry fields. 30 (display/alerts) depends on 29 (data). Depends on Session 13 for traded-goods mandatory batches.

### Session 15 — Factory RBAC & restrictions 🟠 · Schema: yes
| Doc | Title |
|-----|-------|
| 47 | Factory Role RBAC & Restrictions |

Adds factory permission keys + restrictions (financials/CRM/sales/POS denied). Depends on Session 11's role. Kept alone — RBAC correctness needs isolated testing.

---

## Phase 4 — POS & Zero-Value Orders (Modules 10, 11)

### Session 16 — POS payment & customer capture 🟠 · Schema: yes
| Doc | Title |
|-----|-------|
| 31 | LankaQR Payment Method |
| 32 | Mandatory Customer Contact in POS |

Schema additions (payment enums + enforcement). Both are POS checkout changes — grouped.

### Session 17 — Zero-value order verification 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 33 | Zero-Value Order Reason Selection |
| 34 | Replacement Linkage & Validation |
| 35 | Owner's Daily Zero-Value Audit Dashboard |

Schema-heavy (zero-value reason field + linkage). One fraud-prevention work unit.

---

## Phase 5 — Petty Cash Management (Module 12)

### Session 18 — Standalone petty cash fund 🔴 · Schema: yes
| Doc | Title |
|-----|-------|
| 36 | Standalone Petty Cash Fund & Opening Balance |
| 37 | Petty Cash Expense Categories |
| 38 | Expense Receipt Upload |

Schema-heavy: new fund concept + categories + upload. Grouped as the petty-cash data-model pass.

### Session 19 — Petty cash supervision & reporting 🟠 · Schema: yes
| Doc | Title |
|-----|-------|
| 39 | Petty Cash Balance Equation |
| 40 | Petty Cash Low-Balance Alerts |
| 41 | Petty Cash Audit Trail Export |

Depends on Session 18. Balance equation + alerts + export. Schema addition for alert threshold/type.

---

## Phase 6 — Invoicing, Recovery & Security (Modules 13, 14, 15)

### Session 20 — Order/shipping invoice template 🟡 · Schema: no
| Doc | Title |
|-----|-------|
| 42 | Order / Shipping Invoice Template |

Extends the existing `ShippingLabel.tsx` branding/designer. No schema change.

### Session 21 — Failed-order recovery 🔴 · Schema: no
| Doc | Title |
|-----|-------|
| 43 | Courier Failure Reason Display |
| 44 | Failed-Order Recovery & Redelivery Workflow |
| 45 | Recovery Lifetime Tracking & Staff Metrics |

Activates the dead `DeliveryRecovery` scaffold. No schema change (model already exists). 45 depends on 44.

### Session 22 — Security hardening 🟠 · Schema: no
| Doc | Title |
|-----|-------|
| 46 | Reports API Permission Gating |
| 48 | SUPER_ADMIN Store-Permission Handling |
| 49 | Audit Page Direct-URL Role Gating |

RBAC hardening across reports API + permission helper + audit page. No schema change.

### Session 23 — Multilingual support 🟡 · Schema: no
| Doc | Title |
|-----|-------|
| 06 | Multilingual Support (Sinhala / English / Tamil) |

Large, cross-cutting i18n effort touching every UI string in `website/` (+ optional `erp/`). Kept alone.

---

## Consolidated Roadmap

| Session | Docs | Phase | Priority | Schema? |
|---------|------|-------|----------|---------|
| S1 | 01 | 0 — Foundations | 🔴 | yes |
| S2 | 02, 03, 04, 05 | 0 — Foundations | 🟠 | no |
| S3 | 07 | 0 — Foundations | 🔴 | yes |
| S4 | 08, 09 | 0 — Foundations | 🔴 | no |
| S5 | 10 | 1 — Reconciliation | 🟠 | yes |
| S6 | 11 | 1 — Reconciliation | 🟠 | no |
| S7 | 12, 13, 14 | 1 — Reconciliation | 🟠 | yes |
| S8 | 15, 16, 17 | 1 — Reconciliation | 🔴 | yes |
| S9 | 19, 20, 21 | 2 — CRM | 🟠 | optional |
| S10 | 18 | 2 — CRM | 🟡 | no |
| S11 | 24, 25 | 3 — Factory | 🔴 | yes |
| S12 | 26, 27 | 3 — Factory | 🔴 | yes |
| S13 | 28 | 3 — Factory | 🔴 | yes |
| S14 | 29, 30 | 3 — Factory | 🔴 | yes |
| S15 | 47 | 3 — Factory | 🟠 | yes |
| S16 | 31, 32 | 4 — POS | 🟠 | yes |
| S17 | 33, 34, 35 | 4 — POS | 🔴 | yes |
| S18 | 36, 37, 38 | 5 — Petty Cash | 🔴 | yes |
| S19 | 39, 40, 41 | 5 — Petty Cash | 🟠 | yes |
| S20 | 42 | 6 — Invoicing | 🟡 | no |
| S21 | 43, 44, 45 | 6 — Recovery | 🔴 | no |
| S22 | 46, 48, 49 | 6 — Security | 🟠 | no |
| S23 | 06 | 6 — i18n | 🟡 | no |

**Total: 23 sessions covering all 49 plan documents.**

---

## Suggested execution order (recommended track)

For fastest business value, run sessions in this order — foundations first, then revenue, then operations:

1. **S3** (online payments) → **S4** (tracking) → **S2** (shop filters) — complete the e-commerce checkout story.
2. **S1** (product content) — enrich product pages for conversion.
3. **S17** (zero-value fraud) — high compliance/risk value.
4. **S21** (failed-order recovery) — completes the courier operations loop.
5. **S11 → S14** (factory/traded/batch) — inventory expansion.
6. **S5 → S8** (reconciliation) — financial accuracy.
7. **S9, S10** (CRM/loyalty/export).
8. **S16** (POS) → **S18, S19** (petty cash).
9. **S22** (security) → **S20** (invoice) → **S23** (i18n).

---

## Reference
- [Document series index](./README.md)
- [SRS Gap Analysis](../SRS%20Gap%20Analysis%20-%20Current%20System%20vs%20Requirements.md)
