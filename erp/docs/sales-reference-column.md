# Sales reference column (ARGUS #85)

The Sales ledger column was labelled **Invoice No**, but its value is the first
8 characters of the sale's cuid (`CMWGJR8W`). There is no sequential invoice
series in the data model, so the label promised something the value is not.

The column is now labelled **Reference**, matching the receipt (`Ref:`), the
detail modal and the return lookup ("Original Sale Reference"). The value and
its click-to-open / copy actions are unchanged; the full cuid is still available
from the copy button and the detail page.

No schema change: a real invoice series needs a per-tenant counter and a
migration, which is out of scope for this cosmetic issue.
