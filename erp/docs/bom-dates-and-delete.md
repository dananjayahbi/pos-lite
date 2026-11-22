# BOM production dates and delete confirmation

ARGUS #255.

Two browser-default surfaces remained in the BOM module:

- **Production history** rendered `new Date(...).toLocaleString()`, which is
  US-style on many machines while the rest of the ERP uses en-GB. It now uses
  the shared `formatStockMovementTimestamp` (`15 Nov 2026, 11:07 pm`), so the
  compact list, the history table and the movement ledger agree. Invalid input
  renders an empty string rather than "Invalid Date".
- **BOM deletion** used `window.confirm("Delete BOM?")`. It now opens the shared
  dialog and names the impact: the recipe leaves the BOM list and production,
  whether production runs are recorded (deletion is blocked - deactivate
  instead), and whether the recipe is currently active. The destructive button
  is disabled for a BOM with production history, matching the server's
  `BOM_LOCKED` refusal.

The service guard is unchanged and remains authoritative.
