# Task 05.03.08 — Perform Accessibility Audit and Fixes

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.08 |
| Task Name | Perform Accessibility Audit and Fixes |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | High |
| Estimated Duration | 4–6 hours |
| Assignee Role | Lead Developer / UI Developer |
| Dependencies | All UI components across all phases, ShadCN/UI installed, all forms implemented using React Hook Form |
| Output Files | Modifications to existing component files across the entire src/ tree |

## Objective

Perform a comprehensive accessibility audit of the VelvetPOS application and implement all identified fixes. The audit covers ARIA labelling for icon-only controls, ShadCN modal component title elements, focus management after modal dismissal, colour contrast compliance against WCAG 2.1 AA standard, form label association, and live region announcements for toast notifications. This task produces no new files — it is exclusively a series of targeted fixes applied to the existing component and page tree.

## Context

Accessibility is a legal and ethical requirement, not an optional enhancement. In Sri Lanka, web accessibility standards follow international WCAG guidelines, and enterprise customers increasingly require WCAG 2.1 AA compliance as a procurement condition. ShadCN/UI ships with strong accessible defaults (Radix UI primitives), but the application layer code built on top of those primitives requires explicit audit to catch gaps in ARIA labelling, keyboard navigation, and focus management that are not automatically handled by the component library.

## Instructions

**Step 1: Audit and Fix All Icon-Only Buttons**

An icon-only button is any interactive button element that renders a visual icon with no visible text label. Without an aria-label, screen reader users hear only "button" with no indication of function. Locate and fix the following icon-only buttons across the application:

Sidebar navigation collapse toggle: the ChevronLeft/ChevronRight icon button that collapses the left navigation panel. Add aria-label="Collapse navigation" when expanded and aria-label="Expand navigation" when collapsed, toggling with the sidebar state variable.

Search clear button: the ×/XCircle icon button that appears inside search input fields to clear the current query. Add aria-label="Clear search".

Cart item remove button in the POS terminal CartPanel: the Trash2 or X icon button on each line item. Add aria-label set to a dynamic string such as "Remove [product name] from cart", using the line item's product name from the cart state.

Variant quantity stepper buttons in both the POS and the product variant editor: the + and − icon buttons. Add aria-label="Increase quantity" and aria-label="Decrease quantity" respectively.

Table row action menus: the MoreHorizontal or DotsThreeVertical icon button that opens a dropdown menu on each table row. Add aria-label="Open actions for [row context]" where the row context is the item name — for example "Open actions for Blue Silk Blouse".

Notification dismiss button in the toast container: the X icon button on each toast. Add aria-label="Dismiss notification".

Date picker open trigger: if the calendar icon button opens a date picker overlay, add aria-label="Open date picker".

After fixing each button, run a targeted grep across the codebase using the search term "icon" combined with "Button" to catch any remaining instances that may have been missed. Each instance must have either a visible text label or an aria-label prop.

**Step 2: Verify ShadCN Modal Title Elements**

ShadCN Dialog, Sheet, and AlertDialog components all require a title element for screen reader announcement. The title element is rendered visually and announced when the modal opens. Audit every usage of the following ShadCN components in the codebase and verify the accompanying title component is present:

Every Dialog must contain a DialogTitle element inside a DialogHeader. If a design requires a visually hidden title (the modal has a visible heading in the body that serves as the title), wrap the DialogTitle in a ShadCN VisuallyHidden component rather than removing it entirely — removing it silently breaks screen reader announcement.

Every Sheet must contain a SheetTitle inside a SheetHeader.

Every AlertDialog must contain an AlertDialogTitle inside an AlertDialogHeader.

Search for all occurrences of these components using grep and check each one. Create a note of any Dialog/Sheet/AlertDialog instance missing its title sibling and fix each one.

**Step 3: Verify Focus Management After Modal Dismissal**

When a modal dialog closes, keyboard focus must return to the element that triggered the modal to open. Radix UI (which underlies ShadCN) handles this automatically via its internal focus trap and restore mechanism, provided the trigger element is a standard interactive element. Verify this behaviour in the following flows:

Open and close the Add Product modal triggered from the products page header button. Confirm focus returns to the "Add Product" button. Open and close the Delete Confirmation AlertDialog triggered from a table row action. Confirm focus returns to the table row action trigger button. Open and close the Sale Receipt detail Sheet. Confirm focus returns to the sale row that was clicked. If any of these verification steps fail (focus lands on the body or a wrong element), inspect whether the trigger element is wrapped in a non-interactive div instead of a button and fix the semantic structure.

**Step 4: Verify Colour Contrast Ratios**

Check the following key colour pairings against the WCAG 2.1 AA minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text (18px+ or bold 14px+). Document the result for each pair in this task's Notes section.

Espresso (#3A2D28) text on linen (#EBE3DB) background: this is the primary body text combination. Calculate the contrast ratio using the WCAG relative luminance formula. The expected result exceeds 7:1, passing AAA. Espresso (#3A2D28) text on pearl (#F1EDE6) background: the sidebar and card background combination. Expected to pass AA. Terracotta (#A48374) text on linen (#EBE3DB) background: used for active nav items and section headings. This combination sits in the 3–4:1 range and must be verified — use terracotta only for large text (18px+) to ensure compliance. White (#FFFFFF) text on terracotta (#A48374) background: used for CTA buttons and status badges. Verify this passes AA for button label text sizes. Mist (#D1C7BD) text on espresso (#3A2D28) background: used for sub-labels in dark-mode-adjacent dark card sections. Verify passes AA.

If any pairing fails the required ratio, adjust the colour value slightly darker or lighter until compliance is met. Do not introduce new hex values outside the design token set — instead, darken or lighten an existing token by 10–15% luminance. Document any adjusted values in the design token definition file.

**Step 5: Verify All Form Inputs Have Associated Labels**

Every input, select, textarea, and checkbox rendered via React Hook Form must have an associated label element. The label must be connected to its input either via htmlFor matching the input's id attribute, or by nesting the input directly inside the label element. ShadCN Form components (FormLabel, FormControl) handle this automatically when used correctly with the id prop — audit that no FormControl is rendered without an accompanying FormLabel in the same FormItem.

Search for all instances of Input, Select, Textarea, and Checkbox from ShadCN/UI across the codebase and verify each has a containing FormLabel or a standalone label with a matching htmlFor. Pay special attention to inline edit fields on the POS terminal (quantity edit inputs), filter inputs on list pages, and any dynamically generated variant fields on the product form — these are the most likely places where labels were omitted for brevity during initial development.

**Step 6: Add ARIA Live Region to Toast Container**

The toast notification container that renders feedback messages (sale completed, product saved, error occurred) must announce its content to screen readers. Locate the Toaster or ToastViewport component from ShadCN/UI in the application root layout or in src/components/ui/toaster.tsx. Add the props role="status", aria-live="polite", and aria-atomic="false" to the toast container element. This instructs assistive technologies to announce new toast messages when they appear without interrupting ongoing announcements. For error toasts specifically (variant="destructive"), use aria-live="assertive" by conditionally applying the prop based on the toast variant. If the Toaster component from ShadCN/UI renders its own internal ARIA attributes, verify they are set correctly in the component definition and do not need manual overrides.

**Step 7: Add Skip Navigation Link**

Add a visually hidden "Skip to main content" anchor link as the very first focusable element in the document body, before the sidebar navigation. This link should be invisible until focused (use translate-y-[-100%] which transitions to translate-y-0 on :focus). Its href should point to "#main-content" and the main content area should have id="main-content" applied. This allows keyboard users navigating with the Tab key to bypass the sidebar navigation on every page navigation event. Place this link in the root layout component in src/app/(dashboard)/layout.tsx.

## Expected Output

Modifications to existing files throughout src/ including:

- All icon-only button components across the POS terminal, sidebar, table rows, and form controls — aria-label props added to each
- All ShadCN Dialog, Sheet, and AlertDialog usages verified to contain their respective title elements
- Toast container (src/components/ui/toaster.tsx) updated with role="status" and aria-live="polite"
- src/app/(dashboard)/layout.tsx updated with skip navigation link
- Any colour token value adjustments documented in the design token configuration file

## Validation

- [ ] All icon-only buttons in the POS terminal CartPanel, sidebar, and table action menus carry descriptive aria-label props
- [ ] All Dialog, Sheet, and AlertDialog components in the codebase contain their required title child elements
- [ ] Pressing Tab from the first position in the document and then Enter activates the "Skip to main content" link
- [ ] Focus returns to the triggering button after dismissing all key modals (Add Product dialog, Delete AlertDialog, Receipt Sheet)
- [ ] Espresso-on-linen contrast ratio passes WCAG 2.1 AA (minimum 4.5:1) — confirmed with the browser accessibility DevTools panel
- [ ] White-on-terracotta CTA button contrast ratio passes WCAG 2.1 AA
- [ ] All form inputs in the product form, customer form, and sales return form have associated label elements
- [ ] Toast container carries role="status" aria-live="polite" and announces new toast text to a screen reader

## Notes

- Use the Chrome DevTools Accessibility panel (in the Elements inspector) to verify ARIA tree output for complex components. The "Inspect Accessibility Tree" view shows exactly what a screen reader receives without requiring an actual screen reader installation.
- Contrast ratio calculations: the WCAG 2.1 formula is (L1 + 0.05) / (L2 + 0.05) where L1 and L2 are the relative luminance values of the lighter and darker colours respectively. Tools such as coolors.co/contrast-checker or the WebAIM Contrast Checker accept hex values and return the ratio with a pass/fail indicator.
- Terracotta (#A48374) on linen (#EBE3DB) will likely produce a contrast ratio near 2.5:1, which fails AA for normal text. Ensure terracotta is used only for large text headings (18px regular or 14px bold) on linen backgrounds, where the requirement drops to 3:1. For small UI text on linen, use espresso instead.
