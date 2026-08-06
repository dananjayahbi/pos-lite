# 18 — Automated Customer Contact Export

**Module:** M5 — Customer Contact Export
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [09](./09-customer-delivery-status.md), [07](./07-online-payment-gateway.md)

## Issue / Current State

There is no automated daily/weekly customer-contact export. The scheduled-job surface exists — `erp/src/app/api/cron/` contains `birthday-greetings`, `birthday-messages`, `daily-summary`, `sync-shipments`, `payment-reminders`, `sync-locations`, `clear-held-deliveries`, and `check-subscriptions` — but none of them compiles customer contact details into a distributable export.

The ERP stores customer phone numbers (and related contact data) on customer/order records, but there is no job that gathers them into an Excel/CSV/Google Sheet or delivers them to a configured destination for marketing or operational campaigns (for example, SMS or WhatsApp outreach).

## Impact

- The business cannot run batch customer outreach (promotions, re-engagement, service notifications) without manually assembling contact lists, which is error-prone and time-consuming.
- No reliable export means compliance and audit trails for who was contacted are informal.
- The customer data already collected in the ERP is under-utilized for legitimate business communication.

## Implementation Plan

### Step 1 — Design the export contract
Define what the export contains: customer name, phone number(s), email (where available), last-order date, order count/total (aligning with customer-value metrics), preferred store/tenant, and opt-out/exclusion flags. Decide the scope options (all customers, active in last N days, new customers, repeat buyers) so the job is configurable rather than fixed.

### Step 2 — Build the export service
Add a service under `erp/src/lib/services/` that queries customer/order data, deduplicates contacts, applies any exclusion/opt-out rules, and renders the result into an exportable file — Excel or CSV (using a spreadsheet library such as `xlsx`), with an optional Google Sheets push via the Sheets API. Keep the data query and the file rendering in separate functions so the format can change without touching the query.

### Step 3 — Add the scheduled job
Add a cron route under `erp/src/app/api/cron/` (for example, `customer-contact-export/route.ts`) following the pattern of the existing cron jobs. The job runs on a configurable schedule (daily/weekly), compiles the contact list via the export service, and delivers it to a configured destination (email recipient, an export directory, or a Google Sheet).

### Step 4 — Configure destination and schedule
Add configuration for the delivery destination and schedule (env or database settings consistent with how other cron jobs are configured). Provide a way to trigger an ad-hoc export on demand for the owner/staff outside the schedule.

### Step 5 — Add safeguards
Ensure the export honours privacy/exclusion rules, logs what was exported and delivered (for audit), and does not include sensitive data beyond what the configured use-case requires.

## Dependencies
- [09](./09-customer-delivery-status.md) / [07](./07-online-payment-gateway.md) add contact-adjacent order data that can enrich the export.
- Module 6 customer-value metrics (docs 19–21) can feed the order-count/total columns.

## Files / Areas affected
- New service under `erp/src/lib/services/` (contact export)
- New cron route `erp/src/app/api/cron/customer-contact-export/route.ts`
- `erp/src/lib/services/order.service.ts` and/or customer-related services (source data)
- New dependency `xlsx` (and optionally Google Sheets API client) in `erp/package.json`
- Configuration for destination/schedule (env or settings)
