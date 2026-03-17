# Task 02.02.05 — Build Variant Edit Panel

## Metadata

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Task ID      | Task_02_02_05                                      |
| Sub-Phase    | 02.02 — Product Management UI                     |
| Complexity   | Medium                                             |
| Depends On   | Task_02_02_04                                      |
| File Target  | src/components/product/VariantEditSheet.tsx        |

---

## Objective

Build the Variant Edit Panel that allows OWNER and MANAGER roles to update an existing product variant's pricing, stock thresholds, identifiers, and images without leaving the Product Detail page. The panel is implemented as a ShadCN Sheet (right-side drawer) so the user retains context of the variant list while editing.

---

## Instructions

### Step 1: Create the VariantEditSheet Component

Create src/components/product/VariantEditSheet.tsx. This component accepts an isOpen boolean, an onClose callback, and a variant object matching the Variant type from src/types/inventory.ts. When isOpen is true the ShadCN Sheet renders from the right edge of the viewport. The Sheet occupies 480 px of width on desktop and full width on mobile. The Sheet's overlay background is a semi-transparent espresso at 40% opacity rather than the default black, keeping the variants table partially visible.

The Sheet header contains the label "Edit Variant" on the left in Playfair Display semibold and below it the variant's SKU in JetBrains Mono mist colour. A close icon button (× using Inter) sits in the top-right corner of the header and calls onClose when clicked.

### Step 2: Build the Edit Form

The form inside the Sheet body uses React Hook Form with a Zod resolver. The schema is exported from src/schemas/variantSchema.ts as variantEditSchema. Fields are stacked vertically with 16 px spacing between groups.

Field layout within the Sheet:

| Field                | Input Type                  | Notes                                                        |
| -------------------- | --------------------------- | ------------------------------------------------------------ |
| SKU                  | Text input                  | JetBrains Mono font, required, minimum 1 character           |
| Barcode              | Text input with auto-gen button | JetBrains Mono font, optional. The auto-generate button (a wand icon, sand outline) sits as a suffix button inside the input. Clicking it sets the barcode field value to a freshly generated Code128-compatible string: 12 uppercase alphanumeric characters prefixed with "VLV" to namespace VelvetPOS barcodes |
| Size                 | Text input                  | Required                                                     |
| Colour               | Text input                  | Required                                                     |
| Cost Price           | Numeric input               | Rs. prefix, right-aligned, 2 decimals; entire field group hidden for users without product:view_cost_price permission |
| Retail Price         | Numeric input               | Rs. prefix, right-aligned; border turns warning-orange if value is numerically less than cost price |
| Wholesale Price      | Numeric input               | Rs. prefix, right-aligned, optional                          |
| Low Stock Threshold  | Integer input               | Minimum 0, default carries over from existing variant        |
| Images               | ImageUploadSection component | Built in Task_02_02_11; wired via Controller in this form    |

The Rs. prefix for all price inputs is rendered as a non-editable span sitting inside the input wrapper, flush with the left edge. The numeric input itself starts after this prefix. Use a ShadCN Input with an adornment pattern to achieve this without conflating the prefix with the actual input value.

### Step 3: Implement the Barcode Auto-Generate Logic

The auto-generate barcode button calls a pure helper function generateBarcode that produces a string of exactly 15 characters: the prefix "VLV" followed by 12 uppercase alphanumeric characters drawn from a cryptographically seeded random source (use the Web Crypto API's getRandomValues for this). The resulting string is Code128-compatible and can be converted to a scannable barcode by the label printing component. The auto-generated value replaces anything currently in the Barcode field but the user can still edit it manually after generation.

### Step 4: Wire the Retail vs Cost Price Warning

Register a watch on both the costPrice and retailPrice fields using React Hook Form's watch. In a useEffect, compare the two values on every change: if retailPrice is numerically less than costPrice, apply a warning border class to the retailPrice input wrapper. This visual cue does not block form submission — it is a soft warning only, because there are legitimate scenarios (closeout pricing, staff discounts) where retail may temporarily be below cost.

### Step 5: Implement Save Behaviour

The Sheet footer contains two buttons: "Cancel" (mist outline) and "Save Changes" (espresso primary). The Cancel button calls onClose without triggering the form, discarding any changes — if the form is dirty (React Hook Form's formState.isDirty is true), first show a brief inline confirmation "You have unsaved changes. Discard them?" with Yes/No options before closing.

Clicking "Save Changes" calls React Hook Form's handleSubmit. On valid submission, the hook calls the PATCH /api/variants/[id] endpoint via the useVariantMutation hook. The payload contains only the fields that were changed (dirty fields only), using React Hook Form's dirtyFields to build the minimal update object.

On success: close the Sheet by calling onClose, display a ShadCN Sonner toast with the message "Variant updated successfully", and call the queryClient's invalidateQueries for the parent product query key to force the Variants tab to refresh with updated data.

On API error: keep the Sheet open, display a ShadCN Sonner toast with the error message from the API response, and do not clear any form values.

### Step 6: Create the useVariantMutation Hook

Create src/hooks/useVariantMutation.ts. This file exports a hook that returns a mutations object wrapping TanStack Query's useMutation configured for PATCH /api/variants/[id], including the onSuccess and onError callbacks described above. Centralising the mutation in a hook prevents the Sheet component from needing direct access to queryClient.

---

## Expected Output

Clicking "Edit" on a variant row in the Product Detail page opens the right-side Sheet showing the variant's current SKU, prices, and images. Editing any field marks the form as dirty. Clicking Save sends the PATCH request, closes the Sheet, shows a success toast, and updates the variant row in the Variants table. Clicking Cancel on a dirty form shows the discard confirmation before closing.

---

## Validation

- Sheet opens with all fields pre-populated from the passed variant prop
- Cost Price field group is hidden when the current user lacks product:view_cost_price
- Auto-generate barcode button sets the Barcode field to a 15-character "VLV"-prefixed string
- Retail price below cost price shows warning border without blocking submission
- Submitting calls PATCH /api/variants/[id] with only the changed fields in the body
- Success toast "Variant updated successfully" appears after close
- Variants table refreshes the updated row after the query invalidation
- Discarding a dirty form prompts the discard confirmation before the Sheet closes
- Multiple variants can be edited sequentially — re-opening the Sheet for a different variant shows that variant's data, not the previously edited one

---

## Notes

- Do not use a Modal (Dialog) for this feature. A Sheet is required because the user should be able to glance at the variants table behind the drawer to compare values while editing
- The Images field in this Sheet is a wire-up placeholder until Task_02_02_11 is complete. In this task, render a static "Image upload coming in Task_02_02_11" placeholder inside the Controller wrapper
- The dirtyFields optimisation is important at scale — sending unchanged fields in every PATCH request creates unnecessary audit log entries in the AuditLog table
