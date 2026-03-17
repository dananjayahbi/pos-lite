# Task 04.03.04 — Build Cash Drawer Integration

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.04 |
| Task Name | Build Cash Drawer Integration |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | High |
| Complexity | Medium |
| Estimated Effort | 2 hours |
| Depends On | 04.03.03 (printer.ts, PrinterConfig type, escpos library installed) |
| Produces | src/lib/hardware/cashDrawer.ts, updated sale.service.ts, updated return.service.ts, POST /api/hardware/test-drawer |

## Objective

Implement automatic cash drawer kicks that fire whenever a cash sale is completed or a cash return refund is processed, using the ESC/POS cash drawer open command sent through the configured thermal printer. Provide a test drawer function for the hardware settings page.

## Context

Most POS-grade cash drawers connect to the computer via the thermal printer's RJ-11 port (a secondary connector on the printer), not directly to the computer. The drawer is opened by sending a specific ESC/POS command sequence through the printer: the DLE EOT command sequence or the standard cash drawer kick command, which consists of ESC (byte 27), p (byte 112), pin selection (byte 0 for pin 2 or byte 1 for pin 5), on-time (byte value 60 representing approximately 60ms × 2ms per unit), and off-time (byte value 60 representing the same off duration).

In prose: the command is a five-byte sequence — ESC, lowercase p, pin 0, duration-on 60, duration-off 60. This activates pin 2 of the cash drawer port for 120 milliseconds then releases it, which is sufficient to disengage the drawer latch on virtually all standard POS cash drawers.

All cash drawer operations are server-side only. The cashDrawer.ts module depends on the printer transport established in printer.ts.

## Instructions

### Step 1: Create the Cash Drawer Module

Create the file at src/lib/hardware/cashDrawer.ts. Import the PrinterConfig type from src/lib/hardware/printer.ts. Import the escpos library. The module exports two functions: kickCashDrawer and testDrawer.

### Step 2: Implement kickCashDrawer

Define and export an async function kickCashDrawer(printerConfig: PrinterConfig). The function opens a printer connection using the same getPrinterAndDevice helper from printer.ts — either export that helper from printer.ts or duplicate the transport-construction logic locally (prefer exporting and reusing it).

Once the printer connection is open, send the cash drawer kick command sequence by calling a raw write or command method on the escpos Printer instance. The ESC/POS cash drawer command is: select pin 0 (drawer pin 2 / RJ-11 pin 2), on-time 60 (each unit is approximately 2ms, so 60 = ~120ms pulse duration), off-time 60 (60 units off before the command is considered complete). After sending the command, close the printer device in a finally block.

Wrap the entire operation in a try/catch. On error, log the error to console.error with the prefix "[CashDrawer] Failed to kick drawer:" followed by the error message. Do not re-throw — a failed cash drawer kick must never block the sale completion or return completion that triggered it. The cash drawer is a peripheral and its failure must be non-fatal.

### Step 3: Implement testDrawer

Define and export an async function testDrawer(printerConfig: PrinterConfig). This function calls kickCashDrawer and re-throws any error. Unlike the automatic kick (which swallows errors), the test function is called from the hardware settings page where the operator explicitly wants to know whether the drawer is working, so errors must propagate to the API route layer.

### Step 4: Integrate into sale.service.ts

Locate the code path in sale.service.ts that runs after a sale is successfully marked COMPLETED. This code path already has the fire-and-forget audit log call added in Task 04.03.01.

Add a conditional cash drawer kick immediately below the audit log call. The kick should only fire when the sale's paymentMethod equals "CASH". Fetch the tenant's hardware settings (or pass the tenantId to a helper that fetches it). Launch the kick as a fire-and-forget unawaited call: void kickCashDrawer(printerConfig). Because kickCashDrawer already swallows its own errors, no additional .catch is needed here.

### Step 5: Integrate into return.service.ts

Locate the code path in return.service.ts that processes a completed return where the refund method is CASH. This is the path that reverses inventory and marks the ReturnRecord COMPLETED.

After the primary Prisma operation resolves, add the same conditional fire-and-forget cash drawer kick: void kickCashDrawer(printerConfig). Only fire when the return's refundMethod equals "CASH". The drawer kick on returns represents the operator opening the drawer to hand the cash refund to the customer.

### Step 6: Create the Test Drawer API Route

Create src/app/api/hardware/test-drawer/route.ts as a POST route handler. Authenticate the session (return 401 if absent, 403 if role is CASHIER or STOCK_CLERK). Fetch the tenant's printer config from the database using the session's tenantId. Call testDrawer with the printer config. On error, return a 500 JSON response with { success: false, message: error.message }. On success, return { success: true }.

## Expected Output

- src/lib/hardware/cashDrawer.ts exporting kickCashDrawer and testDrawer
- sale.service.ts updated with a conditional fire-and-forget cash drawer kick on CASH sales
- return.service.ts updated with a conditional fire-and-forget cash drawer kick on CASH refunds
- src/app/api/hardware/test-drawer/route.ts responding to POST

## Validation

- [ ] Completing a CASH sale calls kickCashDrawer without awaiting it
- [ ] Completing a CARD sale does NOT call kickCashDrawer
- [ ] An error thrown inside kickCashDrawer does not propagate to the calling sale completion function
- [ ] POST /api/hardware/test-drawer returns 200 with { success: true } when the printer is reachable
- [ ] POST /api/hardware/test-drawer returns 500 with a descriptive message when the printer IP is unreachable
- [ ] testDrawer re-throws errors so the API route receives them

## Notes

- Pin selection: pin 0 targets RJ-11 pin 2 (the most common standard). Some cash drawers use pin 5 (byte value 1 for pin selection). If a tenant reports the drawer is not opening, the fallback is to try pin 1. This tuning could be added as an optional cashDrawerPin field in the hardware settings configuration in a future task
- The on-time and off-time values of 60 (approximately 120ms) are sufficient for virtually all standard POS cash drawers. No tenant-facing configuration of these timing values is required in this phase
- Fetching the tenant's hardware settings inside kickCashDrawer requires a database call. To avoid a database call on every sale completion, consider passing the PrinterConfig as an argument from the sale service rather than fetching it inside cashDrawer.ts — the sale service already knows the tenantId and will have the tenant record in scope for the audit log call
