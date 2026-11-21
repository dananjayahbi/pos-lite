# POS shift report surface (ARGUS #113)

`/pos/shift-report?shiftId=…` is a **standalone report surface**, not a page
inside the POS terminal shell.

## Layout decision

The URL is frozen by the QA contract, so the route stays at
`src/app/(store)/pos/shift-report/page.tsx`. Rather than move it and rewrite the
URL, `ShiftGate` (the client gate rendered by `src/app/(store)/pos/layout.tsx`)
now short-circuits for this path:

```tsx
if (isShiftReport) return <>{children}</>;
```

That means the report renders directly in the store layout's `main` element:

- no `POSTerminalShell` top bar or shift controls;
- no `CartPanel`/cart rail and no cart column split;
- no `ShiftOpenModal` blocking the page when the viewer has no open shift — a
  past shift report must be readable without opening a new shift.

Every other POS route keeps the previous behaviour: `ShiftOpenModal` when there
is no open shift, `POSTerminalShell` when there is.

The POS layout's server-side authentication and `SALE.createSale` permission
check are unchanged. The management entry points (`/staff/shifts` and
`/staff/shifts/[id]` → **Open print view**) still link to the same URL.

Because the POS route tree (`StoreLayoutClient`) hides the store sidebar and its
scroll container, the report page wraps itself in a `ReportSurface` that owns
vertical scrolling (`h-dvh overflow-y-auto`). Without this the standalone report
would be clipped by the store layout's `overflow-hidden` shell.

## Print layout

The report owns its print CSS:

- `@page { size: A4 portrait; margin: 12mm; }`;
- the back/print toolbar is `print:hidden`;
- `nav`, `header`, `aside` and any `.print:hidden` element are suppressed, and
  `html`/`body`/`main` print on white;
- the report container drops its max width and padding in print, so the summary
  cards and tables use the full A4 content width;
- sections avoid breaking across pages and table rows avoid splitting;
- **Top Items Sold** always prints (the on-screen list is collapsed by default
  and a print-only copy is rendered).

Browser print/refresh is the same as any normal route: direct navigation and
refresh re-fetch `/api/store/shifts/[id]/z-report` with the `shiftId` query
parameter, so the report data and the Print button keep working.

## Verification

- `npx tsc --noEmit`
- Manual check: open `/pos/shift-report?shiftId=…` directly, refresh, print
  preview; open it from `/staff/shifts/[id]`.
