# M06-04 — BUG-34: edit sheet's FIRST open is completely blank (submit fails "Phone is required")

**Severity:** P2-Major (breaks the primary edit flow on every first use per page load; undiscoverable workaround) · **Module:** 06 Suppliers · **QA pin:** `tests/06_suppliers.spec.ts` F4 (works around via open→close→reopen) · **Depends on:** nothing · **Pattern:** same class as M05-01's form-state issues; a shared "controlled-sheet reset" fix benefits other sheets

## Verified source state (2026-09-15) — still holds
- `src/components/suppliers/SupplierSheet.tsx:55-64` — `useForm({ defaultValues })` captures `supplier?.…` **once at mount**. `src/app/(store)/suppliers/page.tsx:62` initializes `editingSupplier = undefined`, so the sheet mounts with all-blank defaults.
- `SupplierSheet.tsx:67-82` — `handleOpenChange` calls `reset({…supplier values})` **only when `!nextOpen`** (on close). The first edit-open precedes any close → the form still shows stale blank initial values.
- Page passes the row via `supplier={editingSupplier}` (`suppliers/page.tsx:272`), set in `openEdit` (`:100-103`). Second open is correct (close-time reset now sees the chosen supplier).

## Fix approach
1. **Reset on OPEN, keyed to the supplier:** add a `useEffect` (or the shadcn Dialog `onOpenChange` open-branch) that calls `reset(supplierToFormValues(supplier))` whenever `open` becomes true or `supplier?.id` changes — so every open reflects the current row. This is the canonical react-hook-form pattern for an always-mounted, reused sheet.
2. **Or remount:** give the sheet `key={editingSupplier?.id ?? 'new'}` at the page level so a fresh form instance is built per selection — simplest, but loses in-progress state on rapid toggles (acceptable here). Prefer (1).
3. Audit other sheets sharing this shape (`CustomerSheet`, product edit sheet) for the same "reset only on close" bug — the QA suite found it on suppliers first; the pattern likely repeats. Note findings but fix suppliers here (each sheet is its own file).

## Files
- `src/components/suppliers/SupplierSheet.tsx` (reset-on-open), optionally a shared `useSheetForm` helper if applying to multiple sheets.

## Acceptance / gate
- `tests/06` F4: edit opens prefilled on FIRST open (drop the open→close→reopen workaround); immediate Update persists; second-open assertion stays green. Add a UI assertion that the very first open after page load shows the row's values.
