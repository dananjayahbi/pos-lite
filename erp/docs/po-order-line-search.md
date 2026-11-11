# PO order-line product search dropdown

The product search on `/suppliers/purchase-orders/new` (and the shared PO line
editor) renders its results through a portal so the suggestions escape the
card's `overflow-hidden` ancestors.

`useDropdownAnchor.computeDropdownRect` decides whether the panel opens below
or above the input:

- it measures the space below and above the anchor;
- it flips above when the space below cannot fit the preferred panel height
  (320 px) **and** there is more room above;
- otherwise it opens below and clamps `maxHeight` to the available space, with
  a 120 px floor.

The previous rule flipped only when the space below dropped below the 120 px
minimum. A search box near the bottom of the viewport could therefore have
~125 px below, stay downward, and effectively hide every result behind the
viewport edge. Comparing against the preferred height makes the dropdown open
at the top whenever that gives the user more usable rows.

The pure geometry lives in `src/hooks/useDropdownAnchor.ts` and is covered by
`src/hooks/__tests__/useDropdownAnchor.test.ts`, including the 260 px
"usable-but-not-preferred" case.
