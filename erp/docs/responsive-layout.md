# Responsive layout: no clipped content

The ERP is used at very different widths: a 13" laptop at 150% scaling exposes
about 1270 CSS pixels, a tablet about 768, and the app's own sidebar takes 256 px
from those. Content must stay inside its card at every one of those widths; a
hidden horizontal scrollbar is not an acceptable fallback because the operator
cannot see that a column exists.

## What went wrong

The courier-statement comparison kept a ten-column table at `min-w-[980px]`.
With the sidebar and page padding, a 1270 px window had ~916 px for the card, so
the last column was clipped and there was no obvious way to reveal it. Several
toolbars had the same shape: a fixed-width search field plus buttons in a single
non-wrapping flex row, and the reports page stacked its own 224 px sidebar on
top of the app sidebar from `md` upwards.

## Rules

1. **Do not rely on `.overflow-x-auto` to hide a layout problem.** It is fine
   for genuinely tabular data that the operator scrolls deliberately, but the
   important values must be visible without it.
2. **Switch dense tables to record cards at narrow widths.** Use a card list
   with labelled fields (`dt`/`dd`) and keep the table for wide screens:
   - Courier comparison: cards `< 2xl`, table `≥ 2xl`.
   - Reconciliation ledger: cards `< xl`, table `≥ xl`.
   - The card is what carries `data-testid` for tests.
3. **Toolbars wrap; they do not squeeze.** Page headers use
   `flex flex-col gap-3 sm:flex-row` and action groups use `flex-wrap`. A fixed
   `w-72` field becomes `w-full sm:w-64`.
4. **Flex children get `min-w-0`.** Text containers need it before
   `truncate`/`break-words` can work; grid/flex children otherwise keep an
   automatic minimum based on their content.
5. **Long identifiers wrap.** Waybills, order refs, SKUs and filenames use
   `break-all`/`break-words` or `truncate` with a `title` attribute.
6. **One sidebar per width.** The app sidebar appears at `md` (768). Secondary
   sidebars (the report directory) only appear at `xl` (1280); below that they
   are a sheet triggered from the header.
7. **`main` keeps `overflow-x-hidden` as a last resort,** not as the fix. It
   prevents a transient horizontal scrollbar but would silently clip anything
   that still overflows, which is exactly the bug this document guards against.

## Verification

`tests/44_responsive_overflow.spec.ts`:

- opens the courier comparison with a real workbook and asserts cards at
  1270 px, the table at 1536 px, and no clipped text;
- visits the dashboard, inventory, customers, sales, delivery, packaging,
  rate card, store settings and reports at 375 / 640 / 768 / 1024 / 1270 px;
- fails if `main.scrollWidth` exceeds `main.clientWidth`, or if a
  hidden-overflow box contains text wider than itself without an ellipsis.

`tests/34_reports_analytics.spec.ts` also covers the report directory and the
report sidebar at the default 1280 px viewport.
