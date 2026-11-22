# Suppliers page permission gate

ARGUS #240.

Every supplier API returns `403` for a cashier, but `/suppliers` still rendered
the normal page: an empty "No suppliers found" table and an active **Add
Supplier** button whose sheet only failed on submit.

The page now reads effective permissions with `usePermissions`:

- without `supplier:view` it renders an **Access Denied** card with a link back
  to the dashboard, and the supplier query is `enabled: false` so no guaranteed
  403 request is fired;
- **Add Supplier** requires `supplier:create`;
- edit, archive and restore rows require `supplier:edit`; a view-only role sees
  a "Read only" note instead of actionable controls, and the supplier name is no
  longer an edit trigger;
- a permissions-loading skeleton avoids flashing the denial card.

Server-side permissions, tenant scoping and the archived-row read-only rule are
unchanged and remain the source of truth.
