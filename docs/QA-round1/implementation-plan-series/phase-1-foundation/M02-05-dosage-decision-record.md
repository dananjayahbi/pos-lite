# M02-05 — GAP-1 (CLOSED, accepted by design): dosage recommendations handled via Description / Usage

**Severity:** — (decision record, no code) · **Module:** 02 Products · **QA ref:** `QA_BUG_REPORT.md` GAP-1; `QA_CLIENT_REQ.md` §2.1 bullet 4 · **Status:** closed 2026-09-04

## What it is
Client req 2.1 asked for "Safety warnings & Dosage recommendations fields". Safety warnings got a dedicated field (`Product.safetyPrecautions`); dosage recommendations did **not** get a dedicated column. The product team decided (2026-09-04) that dosing guidance is authored inside the existing free-text `Product.usageInstructions` / `Product.description` — so req 2.1 bullet 4 is marked `[x] — Handled via Description / Usage`.

## Verified source state (2026-09-15) — decision still reflected in code
- `prisma/schema.prisma` `model Product`: has `activeIngredients`, `usageInstructions`, `healthBenefits`, `safetyPrecautions`, `healthConcerns`, `productSource` — **no dosage field** (by design).
- `PRODUCT_FORMS` (POWDER/TABLET/OIL/…) is the physical **form factor** of a variant, not dosing guidance — not a substitute, correctly noted by QA.
- Health-content UI (`HealthContentFields.tsx`, `ProductDetailsCard.tsx`) renders the four existing fields.

## Why this doc exists (reopen trigger)
Record the **residual risk** so a future session doesn't "fix" a closed item or miss a real requirement change:
- Dosing text is unstructured → cannot be validated, filtered, or rendered as a distinct storefront "Dosage" section; per-dosage-form rules (adult vs child) are impossible without a schema change.
- **Reopen GAP-1 as a schema change IF** the client asks for structured dosage data, storefront dosage filtering, or a dedicated "Dosage" section on the public product page (ties to M28/REQ-05 storefront).

## Action
None in code. This is the traceability anchor so the QA→implementation mapping stays honest (an id marked `[x]` for a reason, not an oversight).
