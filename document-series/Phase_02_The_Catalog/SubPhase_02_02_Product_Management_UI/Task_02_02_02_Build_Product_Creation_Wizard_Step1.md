# Task 02.02.02 — Build Product Creation Wizard Step 1

## Metadata

| Field        | Value                                         |
| ------------ | --------------------------------------------- |
| Task ID      | Task_02_02_02                                 |
| Sub-Phase    | 02.02 — Product Management UI                 |
| Complexity   | Medium                                        |
| Depends On   | Task_02_02_01                                 |
| Route        | /dashboard/[tenantSlug]/inventory/new         |
| File Target  | src/app/dashboard/[tenantSlug]/inventory/new/page.tsx |

---

## Objective

Build the first step of the multi-step Product Creation Wizard. Step 1 collects all core product-level fields: name, description, category, brand, gender, tags, and tax rule. The wizard is implemented as a single page route with an internal stepper — navigating between steps does not change the URL, preserving the filled-in data in Zustand across the whole session.

---

## Instructions

### Step 1: Create the Zustand Wizard Store

Create src/stores/productWizardStore.ts. This store holds all the data that the wizard collects across its three steps so that navigating between steps never loses previously entered values. The store contains: a step field (1, 2, or 3), a step1Data object holding the basic product fields, a step2Data object holding the variant matrix rows, and actions goToStep, setStep1Data, setStep2Data, and resetWizard. The resetWizard action is called when the wizard is cancelled or after a successful product save, clearing all stored data.

### Step 2: Create the Wizard Page Shell

Create the page at src/app/dashboard/[tenantSlug]/inventory/new/page.tsx as a client component. The page renders WizardProgressBar at the top, then conditionally renders WizardStep1BasicInfo, WizardStep2Variants, or WizardStep3Review based on the current step value from the wizard store. Wrap the entire wizard in a pearl background card with a mist border, centred in the linen page background with a max-width of 800 px for comfortable reading on wide screens.

Check the user's product:create permission on mount — redirect to /dashboard/[tenantSlug]/inventory if the permission is absent, preventing direct URL access by CASHIER roles.

### Step 3: Build the WizardProgressBar Component

Create src/components/wizard/WizardProgressBar.tsx. The bar shows three pill-shaped step indicators in a horizontal row connected by lines. Each pill contains a step number and a label: "1 · Basic Info", "2 · Variants", "3 · Review". The active step pill is filled with espresso background and pearl text. Completed steps (step number less than current) use a terracotta background with pearl text and a checkmark icon in place of the number. Pending steps (step number greater than current) use a mist outline border with espresso text. Connecting lines between pills are sand coloured. The bar is not interactive — users navigate using the Next and Back buttons, not by clicking step pills.

### Step 4: Build WizardStep1BasicInfo Component

Create src/components/wizard/WizardStep1BasicInfo.tsx. This component owns its own React Hook Form instance scoped to the step 1 fields. The Zod schema for this step is defined inline in src/schemas/productSchema.ts and exported as productStep1Schema.

The form fields are laid out in a single-column stack:

- Product Name: a required text input with an Inter label "Product Name". Validation: minimum 2 characters, maximum 120 characters. Placeholder: "e.g. Classic Oxford Shirt".
- Description: an optional Textarea with a label "Description". Placeholder: "Describe the product for your staff and for reports." Validation: maximum 1000 characters. A small character count indicator below the textarea updates on change.
- Category: a ShadCN Select component populated by the useCategories hook. Displays category names in a flat list grouped by parent where applicable. Below the Select, a small link reads "＋ Create new category" — clicking this opens the InlineCategoryMiniModal (a compact ShadCN Dialog with just a name input) without leaving the wizard. On successful category creation, the Select re-fetches via query invalidation and auto-selects the newly created category.
- Brand: a ShadCN Select component populated by the useBrands hook, marked optional. A "＋ Create new brand" link below mirrors the category pattern.
- Gender: a ShadCN RadioGroup with five options presented as visual chip-style radio buttons in a horizontal row: Men, Women, Unisex, Kids, Toddlers. The selected option uses an espresso background with pearl text; unselected options use a mist outline. This field is required.
- Tags: a TagInput component (src/components/product/TagInput.tsx). The user types a tag name in the input field and presses Enter or comma to add it. Each tag appears as a small espresso chip with a × button to remove it. Maximum 20 tags. Tag values are normalized to lowercase on save. The input uses Inter font for typing but the rendered chips use a small Inter semibold label.
- Tax Rule: a ShadCN Select with three fixed options: "Standard VAT (15%)", "SSCL", and "VAT Exempt". Default selection is "Standard VAT (15%)".

### Step 5: Build the TagInput Component

Create src/components/product/TagInput.tsx. This component manages an internal array of tag strings via React Hook Form's Controller interface so it integrates cleanly with the step 1 form. It accepts a value array and an onChange callback. Detect Enter and comma keypresses on the internal text input to trigger tag addition. Prevent duplicate tags (case-insensitive check). Trim whitespace from new tags before adding. The chip row wraps to multiple lines when many tags are added.

### Step 6: Wire Navigation Buttons

The bottom of WizardStep1BasicInfo contains two buttons in a horizontal row. The left button "Cancel" has a mist outline style and navigates back to /dashboard/[tenantSlug]/inventory after calling resetWizard on the store. The right button "Next: Add Variants →" has espresso background and pearl text. Clicking it calls React Hook Form's handleSubmit — if validation passes, the validated step 1 data is written to the wizard store via setStep1Data and the wizard advances to step 2 by calling goToStep(2). If validation fails, form-level error messages appear inline below each invalid field in the standard ShadCN FormMessage style.

---

## Expected Output

Navigating to /dashboard/[tenantSlug]/inventory/new renders the wizard shell with the three-step progress bar at the top and the Step 1 form below. All six fields render correctly. Selecting a gender option highlights it. Adding tags creates chip elements. The "Create new category" link opens a mini dialog. Clicking "Next" without filling required fields shows inline validation messages. Filling in all required fields and clicking "Next" stores the data in the wizard store and renders the Step 2 UI.

---

## Validation

- /new redirects to /inventory if the user lacks product:create permission
- WizardProgressBar shows step 1 as active (espresso), steps 2 and 3 as mist-outlined
- All six form fields render and accept input
- Gender RadioGroup accepts exactly one selection and shows the active espresso fill
- TagInput adds tags on Enter and comma, renders chips, allows removal via ×, rejects duplicates
- "Create new category" dialog creates a record via the API and auto-selects it in the dropdown
- "Cancel" calls resetWizard and navigates to /inventory
- Clicking "Next" without the required Product Name field shows the inline validation error
- Clicking "Next" with valid data advances the wizard to Step 2 without a page reload

---

## Notes

- The wizard store must be reset on the unmount of the /new page in addition to when Cancel is explicitly clicked, to handle the case where a user navigates away via the browser back button or the sidebar
- The InlineCategoryMiniModal is a compact Dialog with a single controlled input — it does not need to be a full-featured page and should not share state with the larger Category Management page
- The Tax Rule values written to the wizard store should be the internal enum strings (STANDARD_VAT, SSCL, VAT_EXEMPT) not the display labels, so the API payload is clean
