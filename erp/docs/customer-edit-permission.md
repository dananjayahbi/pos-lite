# Customer edit follows `customer:edit`

The customer list and detail rendered Edit for every signed-in user and the
edit sheet opened, but `PATCH /api/store/customers/[id]` rejects a cashier with
403 because CASHIER does not hold `customer:edit`. Delete was already hidden
behind `customer:delete`, so the two actions disagreed even though both are
management capabilities (ARGUS #314).

## Behaviour

`resolveCustomerEditAccess` (`src/lib/services/customerPermissions.core.ts`) is
the single decision point:

- permissions still loading -> `canEdit: false` (no Edit flash before the
  session resolves);
- `customer:edit` absent -> `canEdit: false`;
- `customer:edit` present -> `canEdit: true`.

The list uses it to:

- hide the row pencil;
- refuse to populate/open the edit sheet from the handler;
- keep the sheet closed if an edit was somehow selected without the permission.

The detail page uses it to hide the header Edit button and to render the edit
sheet only for holders of the permission.

Create is untouched: CASHIER holds `customer:create` by design, so "Add
Customer" and the create form remain available. Nothing is hidden behind
`customer:edit` that the API would allow.

## Server side

No route change was needed. `PATCH /api/store/customers/[id]` already calls
`hasPermission(session.user, PERMISSIONS.CUSTOMER.editCustomer)` and returns the
standard 403 envelope; the UI now matches that contract instead of advertising
an action the API forbids.

## Verification

`src/lib/services/__tests__/customerPermissions.core.test.ts` covers the
allowed, forbidden and loading cases.
