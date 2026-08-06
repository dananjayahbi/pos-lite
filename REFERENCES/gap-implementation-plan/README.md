# Gap Implementation Plan — Document Series

**Purpose:** A modular, one-document-per-gap plan series to close every gap identified in the [SRS Gap Analysis](../SRS%20Gap%20Analysis%20-%20Current%20System%20vs%20Requirements.md) after the 2026-08-07 deep system audit.

**Scope covered:** ERP (`erp/`) + customer website (`website/`), all 15 SRS modules.

**How to use this series:**
- Each numbered document addresses **one gap or issue** with: issue/current state, impact, and a comprehensive, code-free implementation plan (modular, component-based).
- The [roadmap](./ROADMAP.md) groups these documents into **implementation sessions** (≤3 documents per session) ordered by dependency and business priority.
- Documents intentionally contain **no code snippets** — they describe what to build and where, so implementation stays modular and consistent with the existing component/service architecture.

---

## Document Map

### Module 1 — Customer-Facing Front-End
| Doc | Title |
|-----|-------|
| [01](./01-product-detail-health-fields.md) | Product Detail Health-Content Fields |
| [02](./02-shop-price-range-filter.md) | Shop Price-Range Filter |
| [03](./03-health-concern-taxonomy.md) | Health-Concern Taxonomy & Filter |
| [04](./04-shop-form-filter.md) | Shop Product-Type / Form Filter |
| [05](./05-sitewide-search.md) | Sitewide Product Search |
| [06](./06-multilingual-i18n.md) | Multilingual Support (Sinhala / English / Tamil) |

### Module 2 — Order Management & Checkout
| Doc | Title |
|-----|-------|
| [07](./07-online-payment-gateway.md) | Online Payment Gateway for Customer Orders |
| [08](./08-public-order-tracking-portal.md) | Public Order Tracking Portal |
| [09](./09-customer-delivery-status.md) | Customer-Facing Delivery Status |

### Module 3 — Logistics & Courier
| Doc | Title |
|-----|-------|
| [10](./10-multi-provider-courier.md) | Multi-Provider Courier Abstraction |

### Module 4 — Financial Reconciliation & Courier Payout
| Doc | Title |
|-----|-------|
| [11](./11-checkout-delivery-fee.md) | Wire Delivery-Fee Calculation into Website Checkout |
| [12](./12-excel-remittance-import.md) | Excel Remittance Import (.xlsx) |
| [13](./13-orderef-match-fallback.md) | OrderRef Matching Fallback |
| [14](./14-discrepancy-categorization.md) | Discrepancy Sub-Categorization |
| [15](./15-net-profit-calculation.md) | Net Profit Calculation Wiring |
| [16](./16-financial-accuracy-audit.md) | Financial Accuracy / Contract-Deduction Audit |
| [17](./17-dispute-flagging-engine.md) | Dispute Flagging Engine |

### Module 5 — Customer Contact Export
| Doc | Title |
|-----|-------|
| [18](./18-customer-contact-export.md) | Automated Customer Contact Export |

### Module 6 — CRM & Repeat Customer Tracking
| Doc | Title |
|-----|-------|
| [19](./19-loyalty-badges.md) | Loyalty & Repeat-Customer Badges |
| [20](./20-repeat-buyers-tab.md) | Repeat Buyers Tab / Filter |
| [21](./21-customer-value-metrics.md) | Customer Value Metrics (Last Purchase, Preferred Categories) |

### Module 7 — Office Packaging Inventory
| Doc | Title |
|-----|-------|
| [22](./22-packaging-size-dimension.md) | Packaging Size (S/M/L) Dimension |
| [23](./23-packaging-lowstock-scan.md) | Scheduled Packaging Low-Stock Scan |

### Module 8 — Factory Store & Raw Materials
| Doc | Title |
|-----|-------|
| [24](./24-raw-material-inventory.md) | Raw Material Inventory (L/Kg) |
| [25](./25-factory-manager-role.md) | Factory Manager Role & Dashboard |
| [26](./26-bom-auto-deduction.md) | Bill of Materials & Auto-Deduction |
| [27](./27-raw-material-alerts.md) | Raw Material Critical-Stock Alerts |

### Module 9 — Traded & Resale Goods
| Doc | Title |
|-----|-------|
| [28](./28-product-source-distinction.md) | Product Source (Manufactured / Traded) |
| [29](./29-batch-expiry-tracking.md) | Batch Numbering & Expiry Tracking |
| [30](./30-batch-expiry-visibility.md) | Batch/Expiry Sales Visibility & Alerts |

### Module 10 — POS / Counter Sale
| Doc | Title |
|-----|-------|
| [31](./31-lankaqr-payment.md) | LankaQR Payment Method |
| [32](./32-mandatory-customer-pos.md) | Mandatory Customer Contact in POS |

### Module 11 — Zero-Value Order Verification
| Doc | Title |
|-----|-------|
| [33](./33-zero-value-order-reason.md) | Zero-Value Order Reason Selection |
| [34](./34-replacement-linkage.md) | Replacement Linkage & Validation |
| [35](./35-zero-value-audit-dashboard.md) | Owner's Daily Zero-Value Audit Dashboard |

### Module 12 — Petty Cash Management
| Doc | Title |
|-----|-------|
| [36](./36-standalone-petty-cash-fund.md) | Standalone Petty Cash Fund & Opening Balance |
| [37](./37-petty-cash-categories.md) | Petty Cash Expense Categories |
| [38](./38-receipt-upload.md) | Expense Receipt Upload |
| [39](./39-petty-cash-balance-equation.md) | Petty Cash Balance Equation |
| [40](./40-petty-cash-low-alerts.md) | Petty Cash Low-Balance Alerts |
| [41](./41-petty-cash-export.md) | Petty Cash Audit Trail Export |

### Module 13 — Invoice & Label Printing
| Doc | Title |
|-----|-------|
| [42](./42-order-invoice-template.md) | Order / Shipping Invoice Template |

### Module 14 — Failed Order & Return Recovery
| Doc | Title |
|-----|-------|
| [43](./43-failure-reason-display.md) | Courier Failure Reason Display |
| [44](./44-failed-order-recovery-workflow.md) | Failed-Order Recovery & Redelivery Workflow |
| [45](./45-recovery-staff-audit.md) | Recovery Lifetime Tracking & Staff Metrics |

### Module 15 — Security, RBAC & Audit
| Doc | Title |
|-----|-------|
| [46](./46-reports-api-permission-gating.md) | Reports API Permission Gating |
| [47](./47-factory-role-rbac.md) | Factory Role RBAC & Restrictions |
| [48](./48-superadmin-store-permissions.md) | SUPER_ADMIN Store-Permission Handling |
| [49](./49-audit-page-role-gating.md) | Audit Page Direct-URL Role Gating |

---

## Cross-cutting documents
| Doc | Title |
|-----|-------|
| [ROADMAP](./ROADMAP.md) | Session Grouping & Implementation Roadmap (23 sessions, ≤3 docs each) |

---

## Reference documents
- [SRS Gap Analysis](../SRS%20Gap%20Analysis%20-%20Current%20System%20vs%20Requirements.md)
- [System Requirements Specification (SRS)](../System%20Requirements%20Specification%20(SRS).md)
- [Delivery Integration Plan](../delivery-integration-plan/)
- [Website Module Audit](../website-module-audit/)
