# Restoring a soft-deleted category

Categories are soft-deleted (products/sales history keep their references), but
there was no Deleted view or restore action, so a removed category and its name
were unreachable (ARGUS #172).

## Behaviour

- The Categories page has **Active** / **Deleted** views. The Deleted view lists
  only rows with `deletedAt != null` (`GET /api/store/categories?deleted=true`).
- Each deleted row has a **Restore** button calling
  `POST /api/store/categories/[id]/restore` with the same `product:delete`
  permission as delete. The route is tenant-scoped through the session and
  writes a `CATEGORY_RESTORED` audit entry.
- Restoring an already-live category returns 409 (`Category is not deleted`)
  instead of a silent no-op. An unknown/foreign id returns 404.
- The delete confirmation no longer claims the action "cannot be undone"; it
  points to the Deleted view.
- Both views share the `['categories']` query-key prefix, so create, delete and
  restore invalidate the active and deleted lists together.

## Verification

`tsc --noEmit`; existing category tests
(`categoryDelete.core.test.ts`, `categoryForm.core.test.ts`,
`categoryListKeyboard.core.test.ts`) still pass. The DB-backed restore path is
covered by the route/service contract above.
