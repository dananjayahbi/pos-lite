# Packaging stock list presentation

ARGUS #286.

The list had presentation gaps:

- the Unit column printed the raw enum (`METER`) while quantities read `10 m`;
- there was no search, category/status filter or pagination;
- an empty inventory rendered both the table's empty state and the consumption
  history's "No packaging consumption recorded yet" line;
- low stock was only visible row-by-row, with no page-level alert;
- packaging stock has no cost/value and is not part of stock valuation.

Changes:

- Unit uses `getPackagingUnitLabel` (`Meter`, `Roll`, …), matching the short
  suffixes used beside quantities.
- Client-side search (name/SKU), category filter (tenant category names) and
  stock filter (all / low / out) with 20-row pagination. Filters reset to page 1.
- The table shows one empty state; when filters match nothing it says so instead
  of claiming there are no items. The consumption history is hidden when there
  are no packaging items at all.
- An amber banner counts items at or below their threshold and offers
  **Show low stock**, which applies the status filter.

**Not implemented:** cost/value needs a `unitCost` column on `PackagingItem` (and
a decision on whether valuation includes packaging). No schema change was made;
this is recorded as a schema follow-up rather than faked in the UI.
