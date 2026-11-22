# Purchase-order supplier filter and archived suppliers

ARGUS #238.

The PO list's supplier filter fetched `/api/store/suppliers?limit=100`, which
defaults to active-only. A supplier archived after trading stayed on its POs but
vanished from the filter, so those POs could only be found under "All
Suppliers". The archive dialog promises "Existing POs are not affected".

- The historical PO filter now requests `includeArchived=true` and labels such
  rows with `(archived)`.
- New-PO supplier selection is untouched: the create form still uses the
  active-only supplier list, so an archived supplier cannot receive a new order.

The list endpoint already enforces tenant scope and the `includeArchived` flag;
no API change was required.
