# Stock movement load errors

ARGUS #203.

The page had loading and empty states but no error state: a failed movement
query left `data` undefined, so `movements` fell back to `[]` and the table
rendered the normal "No stock movements found for the selected filters" copy.

The list now distinguishes:

- **loading** - skeleton rows;
- **error** - an `role="alert"` panel with the query's message, a note that
  this is a load failure rather than an empty ledger, and a Retry button;
- **empty** - the existing "no movements" message, only for a successful
  response with zero rows.

Pagination is hidden while the error state is shown so stale page counts are
not presented as current.
