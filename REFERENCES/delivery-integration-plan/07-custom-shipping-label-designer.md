# Delivery Feature — Custom Shipping Label Designer

**Carrier:** Trans Express
**System:** AyurPOS (ERP)
**Date:** 2026-08-06
**Status:** Planned — Not Yet Implemented
**Part of:** `REFERENCES/delivery-integration-plan/` (feature companion to Part 4 §5)

---

## 1. Purpose

The delivery module already ships a **single, hard-coded branded shipping-label template** (`labels/ShippingLabel.tsx`), triggered from the Dispatch Sheet via **Print Label**. It renders a fixed layout with a hard-coded brand name, fixed field set, and fixed colors. Tenants cannot change it.

This document specifies a **Custom Shipping Label Designer** — a per-tenant configuration surface that lets an owner customize the label's content, branding, and styling, and then have every dispatch/re-print render from that saved design. It is a **guidance/specification document only (no code snippets)**, matching the conventions of Parts 1–5. Implementation will follow the existing modular component structure.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- Let each tenant define its own shipping-label look from the UI, with **no code changes**.
- Drive the rendered label from a **saved, per-tenant template** instead of hard-coded values.
- Provide a **live preview** while editing so changes are seen instantly.
- Keep the feature **simple and maintainable** — a structured set of options, not a full drag-and-drop builder (in the first iteration).
- Preserve current behavior: printing from Dispatch and re-printing from the delivery detail page.

### 2.2 Non-Goals (first iteration)
- No free-form drag-and-drop canvas / arbitrary element positioning.
- No multiple named templates per tenant (one active template only).
- No per-waybill overrides at print time.
- No server-side PDF generation/rendering of the label (kept as a client-rendered print window, as today).
- No changes to the invoice template (out of scope; tracked separately in Part 4 §5.2).

---

## 3. Current State (Baseline)

What exists today, to be refactored:

| Item | Current behavior |
|---|---|
| Rendered by | `src/components/delivery/labels/ShippingLabel.tsx` |
| Invoked by | `DispatchSheet.tsx` → `printShippingLabel()` (opens a new window for print/save) |
| Brand name | Hard-coded default `"Ruhunu Wedagedara"`; **not** sourced from tenant branding |
| Logo | None (not rendered) |
| Colors | Fixed espresso/linen palette from design tokens |
| Fields shown | Order Ref, COD, Items, Weight, origin, pickup address — all fixed, no toggle |
| Barcodes | Dual: small internal (order ref) top-right + large courier (waybill) center |
| Persistence | None — template exists only as code |

### 3.1 Gap
- No way for a tenant to show/hide fields, change colors, set the brand name/logo, or choose a page size.
- `printShippingLabel()` ignores the tenant's branding (`getTenantBranding`) entirely, so even the brand name can be wrong for a store.

---

## 4. Requirements

### 4.1 Functional
1. **Designer screen** under Delivery settings (`/delivery/label` or a tab in courier settings) where the owner edits the label template.
2. **Brand controls**: brand name (falls back to tenant branding name if blank), logo (upload or use tenant branding logo URL).
3. **Field visibility toggles**: Order Ref, COD, Item Count, Weight, Origin, Pickup Address. Fields off are omitted from the label.
4. **Styling controls**: accent color, border color, label page size (A6 / A4 / thermal).
5. **Header layout** choice (e.g., brand-left vs brand-centered).
6. **Optional footer note** (e.g., "Fragile", "Handle with care", or a return address line).
7. **Live preview** of the label reflecting all changes in real time.
8. **Save + Reset** (reset to default template).
9. **Dispatch print** and **detail re-print** both render from the saved template; fall back to the default template when none is saved.

### 4.2 Non-Functional
- Per-tenant isolation (template never leaks between tenants).
- Validation on save: hex colors, name length limits, page-size enum, note length limit.
- Access restricted by permission (see §8 RBAC).
- Modular components; no changes to the low-level `react-barcode` usage.

---

## 5. Data Model

### 5.1 Storage strategy
The template is **tenant-scoped configuration**. Two options were considered:

| Option | Approach | Verdict |
|---|---|---|
| **A — JSON in tenant settings** | Store the template under `Tenant.settings.delivery.label` as a typed JSON blob | **Chosen.** Matches the existing `Tenant.settings.delivery.locations` cache pattern already used by `location-sync.service.ts`; no schema migration; simplest and consistent. |
| B — dedicated table | New `DeliveryLabelTemplate` model | Rejected for now — over-engineering for a single per-tenant config; can be promoted later if multi-template is ever needed. |

### 5.2 Template shape (logical fields; implementer maps to a typed object/validator)
| Field | Type | Default | Notes |
|---|---|---|---|
| `brandName` | string | tenant branding name | Empty → use branding name |
| `logoUrl` | string \| null | tenant branding logo | Optional override / uploaded URL |
| `accentColor` | hex color | current espresso token | Header/borders accent |
| `borderColor` | hex color | current espresso token | Label outer border |
| `headerLayout` | `left \| centered` | `left` | Brand header alignment |
| `pageSize` | `a6 \| a4 \| thermal` | `a6` | Print window size hint |
| `showBarcodes` | boolean | `true` | Master barcode toggle |
| `showOrderRef` | boolean | `true` | Order-ref barcode + text |
| `showCod` | boolean | `true` | COD field |
| `showItemCount` | boolean | `true` | Item count field |
| `showWeight` | boolean | `true` | Weight field |
| `showOrigin` | boolean | `true` | Origin city / header sub-line |
| `showPickupAddress` | boolean | `true` | Pickup footer |
| `footerNote` | string \| null | `null` | Optional short note line |

- **Enums:** `pageSize` (`a6 | a4 | thermal`) and `headerLayout` (`left | centered`) map to local const arrays for client-safe validation (mirrors the existing enum-as-const-array pattern used by the delivery/packaging validators, to avoid importing the Prisma client into client components).
- **Validator:** a `LabelTemplateSchema` (zod) lives in a new `lib/validators/label.validators.ts`.

### 5.3 Migration strategy
None required — this uses the existing `Tenant.settings` JSON column. **No Prisma migration, no DB push.**

---

## 6. API & Service Layer

| Route | Method | Purpose | Guard |
|---|---|---|---|
| `GET /api/store/delivery/label` | GET | Return the saved template (or default) | `manageLabelTemplate` |
| `PUT /api/store/delivery/label` | PUT | Validate + persist the template under tenant settings | `manageLabelTemplate` |
| `POST /api/store/delivery/label/reset` | POST | Clear the saved template back to default | `manageLabelTemplate` |

- **Read path:** a small `label.service.ts` exposes `getLabelTemplate(tenantId)` (reads `Tenant.settings.delivery.label`, merges over defaults, resolves brand name/logo from `getTenantBranding`) and `saveLabelTemplate(tenantId, input)`.
- **Audit:** saving/resetting the template writes an audit log entry (`AUDIT_ACTIONS.LABEL_TEMPLATE_UPDATED`) following the existing `createAuditLog` pattern.
- **Error handling:** reuse `mapDeliveryError` / `delivery-route` helpers; unknown errors fall back to `internalError`.

---

## 7. UI & Component Breakdown (Modular)

Follow the established `src/components/delivery/` folder pattern. New components live in **distinct files** — no monolithic additions.

| Component | Path | Purpose |
|---|---|---|
| `LabelDesignerPage` (server) | `src/app/(store)/delivery/label/page.tsx` | Thin guard page → renders the client designer |
| `LabelDesignerClient` | `src/app/(store)/delivery/label/LabelDesignerClient.tsx` | Orchestrates editor + preview, holds form state |
| `LabelTemplateForm` | `src/components/delivery/labels/LabelTemplateForm.tsx` | The editor controls (brand, toggles, colors, page size, note) |
| `LabelPreview` | `src/components/delivery/labels/LabelPreview.tsx` | Live preview rendering from the current template |
| `LabelControls` | `src/components/delivery/labels/LabelControls.tsx` | Reusable field-visibility + styling sub-controls (if form grows) |
| `ShippingLabel` | `src/components/delivery/labels/ShippingLabel.tsx` | **Refactor:** accept a `template` prop instead of hard-coded values; render conditionally on toggles/colors |
| `label.types.ts` | `src/types/delivery-label.ts` | Shared types for the template |

### 7.1 Designer layout
- Two-panel layout: **editor** (left, scrollable controls) + **live preview** (right, renders `LabelPreview`).
- On mobile, preview stacks below the editor.
- **Save**, **Reset**, and **Print Preview** (opens the real print window using the current template) actions in a sticky footer.

### 7.2 Form state
- Use `react-hook-form` + `standardSchemaResolver` with `LabelTemplateSchema`, consistent with other forms.
- Color fields use a color input with a preset swatch set from the design tokens.
- Toggles use the existing `Switch` component.

### 7.3 Rendering behavior
- `ShippingLabel` receives `template` (defaulted server-side / by the hook) and renders:
  - header using `brandName`, `logoUrl` (if provided), `accentColor`, `headerLayout`;
  - each field only if its `show*` flag is on;
  - barcodes only if `showBarcodes` and the corresponding field toggle are on;
  - border with `borderColor`; optional `footerNote`.
- `printShippingLabel()` is updated to load the saved template (via the new service/hook) before opening the print window, falling back to the default when none is saved.

### 7.4 Hooks
- `useLabelTemplate` in `src/hooks/delivery/` — loads the template, exposes `save`, `reset`, and `previewTemplate` state (mirrors `useCourierSettings`).

---

## 8. RBAC & Permissions

| Permission | Value | Default roles |
|---|---|---|
| `DELIVERY.manageLabelTemplate` | `delivery:label:manage` | `OWNER`, `MANAGER` |

- Add to `lib/constants/permissions.ts` under the `DELIVERY` group, following the existing `manageCourierSettings` pattern.
- Add a **"Label Design"** nav entry under the **Delivery** group in `StoreSidebar.tsx` (`/delivery/label`), guarded by the new permission.
- `DISPATCH_STAFF` may **print** labels (unchanged — printing stays under the dispatch/detail actions) but **cannot edit** the template.

---

## 9. Integration with Existing Flow

- **Dispatch Sheet** (`DispatchSheet.tsx`) → Print Label now loads the saved template and passes it to `printShippingLabel`.
- **Delivery detail** → Print Label (existing action) also renders from the saved template.
- **Branding:** brand name and logo default from the tenant's existing branding (`getTenantBranding`), so stores with branding already configured get correct labels automatically; the template overrides only when the owner explicitly sets values.
- **Print CSS:** keep the current print-window approach; `pageSize` adjusts the window dimensions hint (A6/A4/thermal).

---

## 10. Validation & Error Handling

- `LabelTemplateSchema` enforces: `accentColor`/`borderColor` as valid hex; `brandName`/`footerNote` length caps; `pageSize`/`headerLayout` enum membership; boolean toggles.
- On invalid input, `PUT` returns a `validationError` with field details (reuse `validationError`).
- Server reads always merge saved values over the defaults, so a corrupt/partial blob still yields a valid template.

---

## 11. Acceptance Criteria

1. An owner can open **Delivery → Label Design** and edit the template; every change is reflected in the live preview.
2. Saving persists the template per tenant; reloading the page shows saved values.
3. After saving, **Print Label** from Dispatch and from the delivery detail renders the customized label (colors, toggles, brand, logo, page size).
4. Turning a field off removes it from the rendered label; turning barcodes off removes both barcodes.
5. With no saved template, the label renders the existing default look (branding name/logo used).
6. Non-owners / users without the permission cannot access the designer route or the API.
7. Template data for tenant A never affects tenant B.
8. Reset returns the label to the default and logs an audit entry.
9. Type-check and production build pass with zero errors.

---

## 12. Implementation Roadmap

| Phase | Scope |
|---|---|
| **1 — Foundation** | `label.types.ts`, `LabelTemplateSchema`, `label.service.ts`, default template object, `GET/PUT/reset` API routes, permission + nav entry |
| **2 — Rendering refactor** | Refactor `ShippingLabel` to consume a `template` prop; update `printShippingLabel` to load the template |
| **3 — Designer UI** | `LabelDesignerPage`/`Client`, `LabelTemplateForm`, `LabelPreview`, `useLabelTemplate` hook |
| **4 — Hardening** | Audit logging, reset flow, error mapping, edge-case coverage (blank brand, no logo, very long note), build/typecheck verification |

---

## 13. File Inventory (New / Modified)

**New**
- `REFERENCES/delivery-integration-plan/07-custom-shipping-label-designer.md` (this document)
- `src/app/(store)/delivery/label/page.tsx`
- `src/app/(store)/delivery/label/LabelDesignerClient.tsx`
- `src/components/delivery/labels/LabelTemplateForm.tsx`
- `src/components/delivery/labels/LabelPreview.tsx`
- `src/components/delivery/labels/LabelControls.tsx`
- `src/hooks/delivery/useLabelTemplate.ts`
- `src/types/delivery-label.ts`
- `src/lib/validators/label.validators.ts`
- `src/lib/services/label.service.ts`
- `src/app/api/store/delivery/label/route.ts`

**Modified**
- `src/components/delivery/labels/ShippingLabel.tsx` (accept `template`, conditional rendering)
- `src/components/delivery/DispatchSheet.tsx` (load template before print)
- `src/components/delivery/DeliveryDetailPanel.tsx` or its actions (load template on re-print)
- `src/components/layout/StoreSidebar.tsx` (Label Design nav entry)
- `src/lib/constants/permissions.ts` (`DELIVERY.manageLabelTemplate`)
- `src/lib/services/audit.service.ts` (`LABEL_TEMPLATE_UPDATED`)
- `src/lib/api/delivery-route.ts` (any new sentinel error mapping)

**No changes**
- `prisma/schema.prisma` (no migration — template lives in `Tenant.settings`)
- Courier/trans-express adapter, tracking, rate, packaging modules
