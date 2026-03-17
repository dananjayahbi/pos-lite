# Task 02.02.03 — Build Product Creation Wizard Step 2: Variant Matrix Generator

## Metadata

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Task ID      | Task_02_02_03                                            |
| Sub-Phase    | 02.02 — Product Management UI                           |
| Complexity   | High                                                     |
| Depends On   | Task_02_02_02                                            |
| Route        | /dashboard/[tenantSlug]/inventory/new (internal step 2) |
| File Target  | src/components/wizard/WizardStep2Variants.tsx            |

---

## Objective

Build the second step of the Product Creation Wizard: the Variant Matrix Generator. The user defines the size and colour axes of the clothing product, and the system automatically generates every Size × Colour combination as an editable table row. Each generated variant row has editable fields for SKU, cost price, retail price, wholesale price, and low stock threshold. The step validates that at least one variant is retained and that all retained variants have valid pricing before advancing to the review step.

---

## Instructions

### Step 1: Design the Axis Configuration Section

The upper half of Step 2 is divided into two axis configuration panels side by side on desktop and stacked on mobile. The left panel configures sizes; the right panel configures colours.

The Size panel is headed "Sizes" in Inter semibold. At the top of the panel, a row of quick-fill preset buttons is displayed: "S / M / L / XL", "XS – XXL", "2Y / 4Y / 6Y / 8Y / 10Y", and "One Size". Each button has a sand outline style. Clicking one of these preset buttons replaces the current size chips with the preset values by calling a replaceAllSizes action in the local form state. Below the preset buttons, a chip input area shows the current size values. The user can also type a custom size name and press Enter or comma to add it. Each size chip has an × button to remove it. The chips are rendered in Inter font.

The Colour panel mirrors this layout but without preset buttons — colours are entirely user-defined. The user types colour names (for example "Midnight Blue", "Sand Beige", "Crimson") and adds them with Enter or comma. Colour chips show a small 12 × 12 px colour swatch if the typed name is a valid CSS colour name; otherwise they show only the text.

Create src/components/wizard/SizeChipInput.tsx and src/components/wizard/ColourChipInput.tsx as controlled components that accept arrays of strings and fire onChange callbacks when items are added or removed.

### Step 2: Implement the Variant Matrix Generator Logic

The matrix generation logic is a pure function that takes the sizes array and colours array as input and returns an array of variant objects, one per combination. Each generated variant object contains: a combination key (e.g., "S|Midnight Blue"), size, colour, sku (auto-generated string — see Step 3), costPrice defaulting to empty string, retailPrice defaulting to empty string, wholesalePrice defaulting to empty string, lowStockThreshold defaulting to 5, and a selected boolean defaulting to true.

This function is called whenever the sizes or colours arrays change. Its output is used to initialise React Hook Form's useFieldArray for the variants array. When the arrays change after the table has been generated and the user has entered pricing data, the matrix must intelligently merge: existing combinations that are still valid retain their user-entered pricing, new combinations get default values, and removed combinations are dropped. Implement this merge with a Map keyed on combination key.

### Step 3: Implement Auto-Generated SKU Logic

Create a helper function generateSku that takes the product name from the wizard store step1Data, the size, and the colour as inputs. The generated SKU is produced by: taking the first three characters of the product name uppercased, appending a hyphen, appending the size value uppercased with spaces removed, appending a hyphen, and appending the first four characters of the colour name uppercased with spaces removed. For example, a shirt named "Oxford Shirt" in size "M" and colour "Midnight Blue" would yield "OXF-M-MIDN". If the result would duplicate an existing generated SKU in the matrix, append a two-digit numeric suffix to make it unique. The generated SKU can always be overridden manually by the user.

### Step 4: Build the Apply Pricing Shortcut Row

At the top of the variant matrix table, before the first data row, render a special full-width shortcut row styled with a linen background and a sand top border to visually separate it from the main data. This row contains: a label "Apply to all variants" in Inter small italics, a Cost Price numeric input, a Retail Price numeric input, and a sand outline "Apply to All" button. Clicking the button uses React Hook Form's setValue to update the costPrice and retailPrice of every variant row in the useFieldArray simultaneously. This shortcut is useful when all variants share the same base pricing.

### Step 5: Build the VariantMatrixTable Component

Create src/components/wizard/VariantMatrixTable.tsx. This component receives the useFieldArray fields array and the React Hook Form register, control, and formState objects as props. Each row in the table corresponds to one variant combination.

Table columns and their input behaviour:

| Column             | Type            | Behaviour                                                           |
| ------------------ | --------------- | ------------------------------------------------------------------- |
| Checkbox           | Controlled checkbox | Toggles the selected field; unchecked rows are excluded from the final save but remain visible in the table with a muted, greyed-out row style |
| SKU                | Editable text input | Prefilled from the generator, uses JetBrains Mono font, 12 px text size |
| Colour             | Read-only text  | Shows the colour name; not editable in the matrix (colour is defined in the axis panel) |
| Size               | Read-only text  | Shows the size value                                                |
| Cost Price         | Numeric input   | Rs. prefix label, right-aligned, 2 decimal places                  |
| Retail Price       | Numeric input   | Rs. prefix label, right-aligned; turns a warning-orange border if the value is less than the cost price in the same row |
| Wholesale Price    | Numeric input   | Rs. prefix label, right-aligned, optional                          |
| Low Stock Threshold | Integer input  | Default 5, minimum 0                                               |

The table renders inside a horizontally scrollable container on smaller screens. The header row is sand-coloured with Inter semibold labels. Data rows use pearl background with terracotta hover.

### Step 6: Implement Performance Considerations

With a 5-colour × 4-size matrix producing 20 rows, all twenty useFieldArray inputs must register with React Hook Form without causing excessive re-renders. Each VariantMatrixRow should be extracted to its own component and wrapped in React.memo so only the changed row re-renders when a single field value changes. The key for each row is the stable combination key string (e.g., "S|Midnight Blue") rather than the array index, preventing row identity loss when the matrix is regenerated.

### Step 7: Wire Validation and Navigation

Before the user can advance to Step 3, the following validation conditions must all pass: at least one variant row must have selected equal to true; every selected row must have costPrice greater than zero; every selected row must have retailPrice greater than or equal to costPrice. If any condition fails, display a prominent error banner at the top of the table area (not per-field inline errors) summarising what needs to be fixed, for example: "3 variants have a retail price below their cost price." The validated variant data is then written to the wizard store via setStep2Data.

The bottom navigation row contains "← Back" (mist outline) which calls goToStep(1) without clearing step 1 data, and "Next: Review →" (espresso primary) which triggers the validation and advances to step 3 on success.

---

## Expected Output

Arriving at step 2 of the wizard shows the axis configuration panels. Adding sizes and colours causes the variant matrix table to appear below, with one row per combination. Entering a cost price and retail price, then clicking "Apply to All" propagates the values across all rows. Unchecking a variant row greys it out. Clicking "Next" with unchecked rows calculates the final variant set and writes it to the wizard store.

---

## Validation

- Adding three sizes and two colours generates exactly six rows in the variant matrix table
- Changing the sizes array after pricing was entered preserves pricing for unchanged combinations and defaults new combinations
- The Apply to All shortcut fills the cost and retail price fields on every row simultaneously
- A retail price value below cost price on a row turns the retail price input border warning-orange
- Clicking "Next" with zero selected rows shows the validation error banner
- Clicking "Next" with at least one selected valid row writes data to the store and advances to step 3
- Clicking "← Back" returns to step 1 with the step 1 form still populated as it was
- SKU auto-generation follows the three-character product name + size + colour format
- Duplicate auto-generated SKUs within the matrix are disambiguated with a numeric suffix

---

## Notes

- The useFieldArray key must be the stable combination key, not the array index. Using the array index as key causes React to re-render wrong rows when the matrix is regenerated with different sizes or colours
- Wholesale Price is genuinely optional and must not trigger a validation error if left blank
- The read-only Colour and Size cells in the matrix table should still be editable by the user if they identify a typo — but this is a power-user affordance, not the intended flow. Keep the cells as read-only display in this task; advanced editing is handled in the Variant Edit Panel after the product is created
- Do not attempt to validate SKU uniqueness against the database in this step — the uniqueness check happens server-side during the POST /api/products request in Step 3
