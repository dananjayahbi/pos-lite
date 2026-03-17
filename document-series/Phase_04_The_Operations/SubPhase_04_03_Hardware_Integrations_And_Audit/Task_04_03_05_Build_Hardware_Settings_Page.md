# Task 04.03.05 — Build Hardware Settings Page

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.05 |
| Task Name | Build Hardware Settings Page |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | High |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Depends On | 04.03.03 (POST /api/hardware/test-print), 04.03.04 (POST /api/hardware/test-drawer) |
| Produces | /dashboard/[tenantSlug]/settings/hardware page, PATCH /api/settings/hardware route |

## Objective

Provide OWNER and MANAGER users with a dedicated settings page to configure thermal printer connectivity, enable or disable the cash drawer, and enable or disable the Customer Facing Display. The page includes in-context test buttons so that configuration can be verified immediately after changes are saved.

## Instructions

### Step 1: Create the Page Route

Create src/app/dashboard/[tenantSlug]/settings/hardware/page.tsx as a Next.js App Router Server Component. Guard the page server-side: return a 403 page or redirect if the session role is CASHIER or STOCK_CLERK. Fetch the current Tenant record from the database using the tenantSlug from the route params, extracting the settings.hardware sub-object. Pass the existing settings as initial values to the client-side form component.

Add this route to the settings sidebar navigation under a "Hardware" group. The link label should read "Hardware & Peripherals".

### Step 2: Build the Hardware Settings Form

Create src/components/settings/HardwareSettingsForm.tsx as a client component. Accept an initialValues prop typed to match the hardware settings shape: printerType ("NETWORK" | "USB"), host (string), port (number), cashDrawerEnabled (boolean), cfdEnabled (boolean).

Initialise a React state object from initialValues. Render the form using ShadCN Card with a CardHeader reading "Printer Configuration" and a CardContent containing the following fields:

- Printer Type: a ShadCN RadioGroup with two options labelled "Network (TCP/IP)" and "USB". The value is "NETWORK" or "USB"
- Printer IP Address: an Input field labelled "IP Address". Render this field only when printerType is "NETWORK". Apply a conditional visible/hidden class rather than conditional mounting so the value is preserved when toggling
- Printer Port: an Input field with type number, labelled "Port", default value 9100. Render only when printerType is "NETWORK"
- Cash Drawer: a ShadCN Switch labelled "Enable Cash Drawer" with a helper text line reading "Opens the cash drawer automatically on CASH transactions"
- Customer Facing Display: a ShadCN Switch labelled "Enable Customer Facing Display" with a helper text line reading "Shows cart contents on a second screen at /cfd"

Below the fields, render a "Save Settings" button (ShadCN Button, variant default, espresso background). Render validation state: the IP Address field is required when printerType is NETWORK. Use inline form validation (no external library required) — disable the Save button and show an error message beside the IP field if it is empty when NETWORK is selected.

### Step 3: Implement Settings Save

In HardwareSettingsForm.tsx, the Save button onClick handler calls a save async function. The function sends a PATCH request to /api/settings/hardware with a JSON body containing the current form state. On success, show a ShadCN toast with the message "Hardware settings saved". On error, show a destructive toast with the error message.

Create src/app/api/settings/hardware/route.ts as a PATCH handler. Authenticate the session (401 if absent, 403 if role is CASHIER or STOCK_CLERK). Parse the request JSON body and validate that printerType is one of "NETWORK" or "USB". If printerType is NETWORK, validate that host is a non-empty string. Call prisma.tenant.update to merge the submitted hardware fields into settings using a Prisma JSONB deep merge pattern: set settings to { ...existingSettings, hardware: { printerType, host, port, cashDrawerEnabled, cfdEnabled } }. Return the updated settings sub-object as the response.

### Step 4: Add the Test Buttons Section

Below the main settings card, render a separate ShadCN Card with CardHeader "Test Connections". The card contains two rows:

- Printer test row: label "Thermal Printer", description "Sends a test page to the configured printer", and a "Test Print" Button (variant outline). On click, the button sends a POST to /api/hardware/test-print. While the request is in flight, show a spinner inside the button and disable it. On success, show a success toast. On error, show a destructive toast with the error message.
- Drawer test row: label "Cash Drawer", description "Sends a kick signal to open the drawer", and a "Test Drawer" Button (variant outline). On click, sends POST to /api/hardware/test-drawer. Same loading and result toast pattern as the printer test.

Both test buttons should be disabled when the settings have unsaved changes (i.e., when the current form state differs from the last saved state) and show a tooltip reading "Save settings before testing".

### Step 5: Add USB Driver Help Text

At the bottom of the page, render a ShadCN Alert with variant "informational" (or a bordered callout box) containing hardware prerequisite notes:

- For USB printers on Windows: the libusb driver must be installed via Zadig before USB printer detection will work
- For network printers: the printer must be assigned a static IP address on the local network and must be reachable from the server's host machine
- CFD: the Customer Facing Display route at /cfd should be opened in a full-screen browser window on the second monitor, pointed at the store's local server URL

## Expected Output

- Page accessible at /dashboard/[tenantSlug]/settings/hardware with role guard
- Form persisting printer type, IP, port, cash drawer toggle, and CFD toggle to Tenant.settings.hardware
- Test Print and Test Drawer buttons integrated with POST endpoints from Tasks 04.03.03 and 04.03.04
- PATCH /api/settings/hardware updating the hardware settings sub-object idempotently

## Validation

- [ ] Page redirects CASHIER and STOCK_CLERK users
- [ ] Selecting NETWORK type shows IP and port fields; selecting USB hides them
- [ ] Save button is disabled when IP is empty and NETWORK is selected
- [ ] Saving updates Tenant.settings.hardware in the database
- [ ] Test Print button is disabled while a request is in flight
- [ ] Test Drawer button shows a success toast when the drawer responds
- [ ] PATCH /api/settings/hardware does not overwrite other tenant settings outside the hardware sub-object

## Notes

- The PATCH handler must use a Prisma raw update or a read-then-write pattern to merge settings rather than replacing the entire settings JSON column. A safe approach is: fetch the current tenant settings, spread the existing object, and set the hardware key to the new value before calling prisma.tenant.update
- Store the cfdEnabled flag in settings.hardware.cfdEnabled but note that in this phase the CFD route is always accessible regardless of this flag — the flag is informational for future enforcement when the CFD requires a specific license tier
