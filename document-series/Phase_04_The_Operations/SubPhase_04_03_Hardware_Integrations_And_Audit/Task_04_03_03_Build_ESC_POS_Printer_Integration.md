# Task 04.03.03 — Build ESC/POS Printer Integration

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.03 |
| Task Name | Build ESC/POS Printer Integration |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | High |
| Complexity | High |
| Estimated Effort | 3–4 hours |
| Depends On | Tenant.settings.hardware schema shape, Sale and ShiftSession Prisma models |
| Produces | src/lib/hardware/printer.ts, printer config type, POST /api/hardware/test-print |

## Objective

Integrate ESC/POS thermal printing into VelvetPOS by wrapping the escpos npm library in a clean hardware abstraction layer. The printer module must support both Network (TCP) and USB transport modes based on each tenant's hardware configuration, expose purpose-specific print functions for sale receipts and Z-Reports, and provide a test print function for the hardware settings page.

## Context

ESC/POS (Epson Standard Code for Printers) is the de-facto command protocol for thermal receipt printers. The escpos npm library provides a JavaScript API that generates ESC/POS byte buffers and sends them to a printer via a configurable transport adapter. The escpos-network package provides a TCP socket transport (for network-connected printers with a static IP and port, typically port 9100). The escpos-usb package provides a USB transport for directly-connected printers.

Tenant printer configuration is stored in the Tenant table as part of the JSONB settings column, in a nested sub-object at settings.hardware.printer. The shape of that sub-object is: type ("NETWORK" or "USB"), host (string, required when type is NETWORK), and port (number, defaults to 9100 when type is NETWORK).

Because escpos is a Node.js-only package, all functions in printer.ts must only ever be called from Next.js API route handlers (server-side) and never imported in client components.

## Instructions

### Step 1: Install the Required npm Packages

Run pnpm add escpos escpos-network escpos-usb in the project root. If the escpos package version requires peer dependencies (such as a specific version of usb), resolve them by checking the escpos GitHub README and adjusting the install command as needed — for example, escpos-usb may need pnpm add escpos-usb usb to include the native usb binding.

After installing, verify that pnpm tsc --noEmit reports no new type errors. The escpos packages may lack bundled TypeScript declarations; if so, check whether @types/escpos exists or whether you need to create a minimal declaration file at src/types/escpos.d.ts that declares the modules as any-typed to satisfy TypeScript strict mode.

### Step 2: Create the Printer Hardware Module

Create the file at src/lib/hardware/printer.ts. At the top of the file, define and export a TypeScript type PrinterConfig with fields: type (union "NETWORK" | "USB"), host (string, optional), and port (number, optional).

Define a private async helper function getPrinterAndDevice that accepts a PrinterConfig argument and returns a configured Printer instance with its transport. For NETWORK type, instantiate a Network transport from escpos-network using config.host and config.port (defaulting port to 9100). For USB type, instantiate a USB device from escpos-usb and use it as the transport. Wrap the device open call in a Promise and reject if the device cannot be opened within 5 seconds. Return an object containing both the device and the Printer instance.

### Step 3: Define the ESC/POS Receipt Layout

The receipt layout is produced by sequencing ESC/POS printer commands via the escpos Printer API. Document each section of the receipt layout in the following prescribed order:

- Initialization: call printer.font("a") to select font A, and printer.align("CT") to center-align
- Header: print the store name in a larger font style by calling printer.style("B") for bold, then printer.size(1, 1) for normal size. Print the store address and phone number from the tenant record. Print a divider as a sequence of 32 dash characters (—) using printer.text
- Sale information: call printer.align("LT") to switch to left alignment. Print "Receipt No:" followed by the sale id (short), and "Date:" followed by the formatted sale timestamp on separate lines
- Items section: for each SaleItem, print a line with: item quantity left-aligned, product name centre-padded to fill the line width, and line total (quantity × unit price) right-aligned. The total line width for a 58-mm printer is 32 characters; for an 80-mm printer it is 48 characters. Use the printer's configured paper width from the tenant settings (default 58 mm)
- Subtotals: print a divider line, then print Subtotal, Discount (if any), Tax (if any), and Total each right-aligned with their currency values formatted in JetBrains Mono style (two decimal places)
- Payment: print the payment method (CASH / CARD / CREDIT) and, for cash payments, the amount tendered and change due
- Footer: call printer.align("CT"), print a thank-you message from tenant settings or default "Thank you for your visit!", and print the tenant's WiFi/website if configured
- Cut: call printer.cut() to send the paper cut command, then close the device

### Step 4: Implement printSaleReceipt

Define and export an async function printSaleReceipt(saleId: string) that performs the following sequence: fetch the full Sale record from the database using prisma.sale.findUnique, including SaleItems with their related Product and Variant, the related Customer (if any), and the related ShiftSession with its Tenant and hardware settings. Validate that the sale exists, throwing a descriptive error if not.

Extract the PrinterConfig from tenant.settings.hardware.printer. Call getPrinterAndDevice to obtain the printer connection. Build the receipt layout following the sequence documented in Step 3. Catch any printer communication error, close the device in the finally block regardless of success or failure, and re-throw communication errors so the caller can surface them appropriately.

### Step 5: Implement printZReport

Define and export an async function printZReport(shiftId: string). Fetch the ShiftSession record with all aggregated totals — total sales count, total sales amount, total returns count, total returns amount, opening float, closing cash, and all CashMovements for the shift. Fetch the tenant settings for the printer config.

Print the Z-Report layout: centred header "Z — REPORT", shift date and time range, cashier name, a divider, then each section: Sales total, Returns total, Net Revenue, Cash Movements list (type, reason, amount for each), Gross Cash Collected, Expected Cash in Drawer (opening float plus cash sales minus cash returns plus manual-in movements minus petty-cash-out movements), Actual Cash Counted, and Variance. Print print timestamp and session id at the footer. Cut paper.

### Step 6: Implement testPrint

Define and export an async function testPrint(printerConfig: PrinterConfig). This function opens the printer, prints a centred line reading "VelvetPOS — Printer OK" followed by the current ISO timestamp, then cuts the paper and closes the device. It throws if the printer cannot be reached.

### Step 7: Create the Test Print API Route

Create src/app/api/hardware/test-print/route.ts as a POST route handler. Authenticate the session (401 if absent, 403 if role is CASHIER or STOCK_CLERK). Fetch the tenant's printer config from the database. Call testPrint with the config. Catch errors and return a 500 JSON response with { success: false, message: error.message }. On success, return { success: true }.

## Expected Output

- src/lib/hardware/printer.ts exporting PrinterConfig, printSaleReceipt, printZReport, and testPrint
- src/app/api/hardware/test-print/route.ts responding to POST with success or detailed error
- escpos, escpos-network, and escpos-usb installed in package.json
- No TypeScript compilation errors

## Validation

- [ ] pnpm tsc --noEmit passes after package installation and module creation
- [ ] printSaleReceipt fetches all required sale fields and does not throw a type error on missing relations
- [ ] testPrint called with a valid Network config establishes a TCP connection to the specified host and port
- [ ] A network connection error in testPrint results in a 500 response from POST /api/hardware/test-print with a readable message
- [ ] printZReport includes CashMovements in the expected cash calculation
- [ ] GET /api/hardware/test-print returns 405 Method Not Allowed (only POST is defined)

## Notes

- The escpos API is callback-based in older versions and Promise-based in newer versions. Check the installed version and adapt accordingly — wrap callbacks in Promises where needed
- Paper width (58 mm vs 80 mm) affects the character count per line. Store a paperWidth field in PrinterConfig (optional, default "58mm") so the receipt formatter can choose between 32-char and 48-char line widths
- Never call printer.ts functions directly from a React Server Component or Client Component. All printing must go through the API route layer
- USB printer support on Windows requires the libusb native driver. Document this system prerequisite in the hardware settings page help text so that installation staff are aware
