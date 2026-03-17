# Task 02.02.06 — Build Category and Brand Management

## Metadata

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Task ID      | Task_02_02_06                                                     |
| Sub-Phase    | 02.02 — Product Management UI                                    |
| Complexity   | Low                                                               |
| Depends On   | Task_02_02_01                                                     |
| Routes       | /dashboard/[tenantSlug]/inventory/categories and /dashboard/[tenantSlug]/inventory/brands |

---

## Objective

Build the Category Management page and the Brand Management page. Both pages are accessible only to users with the inventory:manage permission. They provide the CRUD tooling for the lookup data that drives the product creation wizard and filter panel throughout the inventory section.

---

## Instructions

### Step 1: Add Permission Guard to Both Routes

Both page server components (src/app/dashboard/[tenantSlug]/inventory/categories/page.tsx and src/app/dashboard/[tenantSlug]/inventory/brands/page.tsx) must check the inventory:manage permission from the session before rendering. If the permission is absent, redirect to /dashboard/[tenantSlug]/inventory with a 302. This prevents CASHIER roles from accessing these management screens even by typing the URL directly.

### Step 2: Build the Categories Page Layout

The Categories page has a two-panel layout. The left panel (approximately 60% width on desktop) contains the category tree list. The right panel (40% width) is reserved for a contextual info card showing statistics for the currently selected category — if no category is selected, the right panel shows a friendly prompt "Select a category to see details."

The page header follows the standard inventory page header pattern: Playfair Display H1 "Categories", a subtitle showing the total category count in Inter small, and a "New Category" button with espresso fill in the top-right.

### Step 3: Build the CategoryTree Component

Create src/components/categories/CategoryTree.tsx. This component fetches categories from GET /api/categories using the useCategories hook. The tree supports exactly two levels: top-level parent categories and their direct children. Grandchild categories are not supported in the data model.

Each category row in the tree shows:
- A disclosure triangle (chevron) on the left if the category has children; a placeholder spacer if not
- The category name in Inter body text
- A product count badge in mist small text showing how many products belong to that category (direct assignment, not counting children)
- An inline edit icon (pencil) that appears on hover; clicking it transitions the category name from a static text span to an in-place text input via a local isEditing state flag
- A delete icon (trash) that appears on hover; shown only if the product count is zero

When isEditing is true for a category row, the name text is replaced by a controlled text input pre-filled with the current name. Pressing Enter or clicking a checkmark confirm icon saves the change via PATCH /api/categories/[id]. Pressing Escape cancels and restores the original name. The react-hook-form focus management must return focus to the confirm button after the save completes.

Clicking the disclosure triangle expands or collapses the children rows with a smooth CSS height transition. Children rows are indented by 24 px and shown in Inter small with a slightly lighter espresso text colour.

### Step 4: Build the Inline Category Form

Create src/components/categories/InlineCategoryForm.tsx. Clicking "New Category" in the page header reveals this form as an inline card directly below the header rather than opening a modal. The form contains: a "Parent Category" select (optional — defaults to no parent for a top-level category), a "Category Name" text input, and two buttons: "Add Category" (espresso fill) and "Cancel" (mist link text). Clicking Cancel hides the form by setting a local showForm state to false. Clicking Add Category validates the name (minimum 2 characters, maximum 50 characters) and calls POST /api/categories. On success, invalidate the categories query and hide the form.

### Step 5: Build the Delete Guard Behaviour

Before calling DELETE /api/categories/[id], the client checks whether the category's product count is greater than zero. If it is, instead of making the API call, show a ShadCN Sonner toast with the message "Cannot delete — [N] products are assigned to this category. Reassign them first." The delete icon is hidden in the tree if productCount is greater than zero, but the API route must also enforce this guard server-side by returning a 409 Conflict status if products reference the category at the time of deletion.

### Step 6: Build the Brands Page

The Brands page uses a simpler flat list. The page at src/app/dashboard/[tenantSlug]/inventory/brands/page.tsx follows the same permission guard as the categories page.

Create src/components/brands/BrandsTable.tsx. This table has four columns: Brand Name (Inter semibold), Logo (a 40 × 40 px thumbnail image, or a placeholder rectangle in mist colour if no logo is set), Product Count (integer), and Actions (Edit and Delete icon buttons). The table header is sand-coloured. Each row has a pearl background with terracotta hover.

Clicking Edit on a brand row opens the BrandEditSheet.

### Step 7: Build the BrandEditSheet Component

Create src/components/brands/BrandEditSheet.tsx. This right-side Sheet is used for both creating a new brand and editing an existing one. The Sheet header shows "Edit Brand" or "New Brand" depending on the context.

Form fields: Brand Name (required text input), Description (optional Textarea), and a Logo image uploader using the same ProductImageUpload component from Task_02_02_11, but limited to a single image. Clicking Save calls PATCH /api/brands/[id] for edits or POST /api/brands for new brand creation, then invalidates the brands query.

The delete guard for brands mirrors the category pattern: if a brand has associated products, show a toast error instead of proceeding with deletion.

---

## Expected Output

Navigating to /inventory/categories shows the two-panel layout with the category tree. Adding a new category via the inline form appends it to the tree. Clicking a category name allows in-place renaming. Attempting to delete a category with products shows the guard toast. The /inventory/brands page shows the flat brands table with Edit and Delete actions working correctly.

---

## Validation

- Both pages redirect to /inventory for users without inventory:manage permission
- CategoryTree renders two levels with correct parent-child indentation
- Inline category form reveals below the header on "New Category" click and hides on cancel or success
- In-place category renaming enables on pencil click, saves on Enter, cancels on Escape
- Delete icon is hidden on categories and brands that have associated products
- Attempting server-side delete on a category or brand with products returns 409 and the client shows the guard toast
- BrandEditSheet opens for both create and edit flows with the correct pre-population

---

## Notes

- Keep both pages as simple as possible — these are utility management screens, not primary user flows. Avoid adding features beyond what is described here
- The "right panel" on the categories page can be a deferred enhancement — in this task, render it as an empty placeholder div with "Select a category" text, and consider populating it with stats in a future task if stakeholders find it useful
- Logo upload in BrandEditSheet depends on Task_02_02_11 being complete first — wire it as a placeholder if that task is not yet done
