# Inventory bulk action bar

Shown at the bottom of `/inventory` when one or more products are selected.

## Layout

- Fixed to the viewport bottom with `z-50`.
- Aligned to the main content on desktop (`md:left-64`, matching the 16rem
  sidebar) so it no longer covers the sidebar navigation.
- Full-width on mobile, with the action row wrapping (`flex-wrap`) instead of
  overflowing.
- The inventory page adds bottom padding (`pb-24`) while a selection exists, so
  the last product row can be scrolled above the bar instead of being hidden
  behind it.

## Buttons

| Button | Behaviour |
| --- | --- |
| Bulk Price Update | Opens the bulk price dialog (requires `product:edit`). |
| Print Labels | Loads the selected products' variants and opens the label dialog. |
| Export Selected | Downloads the selected products as CSV. |
| Clear Selection | Clears the inventory selection store. |

### Contrast fix

The two outline buttons previously used `text-pearl` while the outline variant
paints its own `bg-background` (also pearl), so the labels were invisible —
they rendered as blank white rectangles. They now use:

```
border-pearl/70 bg-transparent text-pearl hover:bg-pearl/10 hover:text-pearl
```

`Export Selected` uses light text (`text-pearl`) on the translucent sand fill so
it is readable on the dark espresso bar, and `Clear Selection` uses a lighter
red (`text-red-300`) for the same reason.

The bar has `role="region"` and `aria-label="Bulk product actions"` for screen
readers.

## Regression check

- Select a product on `/inventory`; confirm all four action labels are visible.
- Confirm the bar starts at the content edge (x=256 at 1496px viewport), not over
  the sidebar.
- Scroll to the bottom with a selection active; the last row must sit above the
  bar.
