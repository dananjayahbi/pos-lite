# Task 04.01.04 — Build POS Customer Linking and Store Credit

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.04 |
| Task Name | Build POS Customer Linking and Store Credit |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | High |
| Estimated Effort | 3–4 hours |
| Prerequisites | 04.01.02 (Customer service layer), SubPhase 03.01 (CartPanel and Zustand cart store) |
| Output | Modified `CartPanel.tsx`, modified sale API route, new `CustomerSearchDropdown.tsx` |

---

## Objective

Extend the POS terminal checkout flow to support linking a customer to an active cart, displaying the customer's store credit balance, and providing a toggle to apply that credit as a payment offset. Both the cart state and the sale completion API must be updated to carry these values through to the final stored sale record.

---

## Context

The cart state is managed by Zustand in `src/store/cartStore.ts` (or equivalent), established in SubPhase 03.01. The CartPanel component renders the right column of the POS terminal. By design, customer linking is additive — no part of the existing cart, line item, or payment logic changes; `customerId` and `appliedStoreCredit` are simply new fields layered onto the existing cart state shape. The sale API route at `POST /api/sales` already wraps all writes in a `$transaction`; the credit redemption call is composed into this same transaction.

---

## Instructions

### Step 1: Extend the Zustand Cart Store

Open the Zustand cart store file. Add the following new fields to the cart state shape:

- `linkedCustomerId: string | null` — defaults to null.
- `linkedCustomerName: string | null` — display name, stored alongside the ID for immediate UI rendering without a secondary fetch.
- `linkedCustomerCreditBalance: string | null` — credit balance as a Decimal-serialised string, stored at the time the customer is linked.
- `appliedStoreCredit: string` — the credit amount the user has chosen to apply, stored as a string to preserve decimal precision. Defaults to `"0"`.

Add the following action functions to the store:

- `linkCustomer(id, name, creditBalance)` — sets all three `linked*` fields.
- `unlinkCustomer()` — resets all four fields to their defaults.
- `setAppliedStoreCredit(amount: string)` — sets `appliedStoreCredit`.

Ensure the cart `reset` action (called after a successful sale) also clears these four fields.

### Step 2: Build the CustomerSearchDropdown Component

Create `src/components/customers/CustomerSearchDropdown.tsx`. This is a Client Component that renders a search input and a dropdown results list. It accepts `onSelect(customer: { id, name, creditBalance })` and `onClear` callbacks.

The component maintains local state for the search string and the dropdown open/closed state. The search input triggers a debounced query after 300 ms of inactivity using `useQuery` from TanStack Query. The query key is `['customer-search', debouncedSearch]` and it calls `GET /api/customers?search=[value]&limit=5`. While typing, show a loading spinner inside the input. Once results arrive, render a positioned dropdown list below the input showing up to 5 matching customers, each displaying name and phone number. Clicking a result calls `onSelect` with the customer data and closes the dropdown.

### Step 3: Add the Customer Linking Section to CartPanel

Open `src/components/pos/CartPanel.tsx`. Near the top of the cart content area, above the cart line items list, add a "Customer" section.

When no customer is linked (default state), render the `CustomerSearchDropdown` component. Selecting a customer triggers `linkCustomer` in the Zustand store.

When a customer is linked, hide the dropdown and render a customer summary row instead: the customer's name in Inter UI, a small muted subtitle showing their credit balance if positive ("Store Credit: Rs. X.XX"), and an × icon button on the far right that calls `unlinkCustomer` when clicked.

### Step 4: Add the Store Credit Toggle

Below the customer summary row, when a linked customer has `creditBalance > 0`, render a store credit application row. Use a ShadCN `Switch` component labelled "Use Store Credit" and a sub-label showing the full available amount ("Rs. X.XX available"). When the switch is toggled on, call `setAppliedStoreCredit` with the value of `Decimal.min(creditBalance, cartTotal).toFixed(2)`. When toggled off, call `setAppliedStoreCredit("0")`.

In the cart totals section below the line items, if `appliedStoreCredit` is greater than zero, insert a new totals row labelled "Store Credit Applied" showing the credit amount in green and subtracting it from the running total. Update the "Amount Due" figure to be `cartTotal - appliedStoreCredit`. Render the Amount Due in JetBrains Mono at a larger size. If the applied credit fully covers the cart, Amount Due should show Rs. 0.00 and the payment input section should accept Rs. 0.00 as a valid entry.

### Step 5: Update the Sale Submission Payload

In the function or handler that builds the sale submission payload (the object posted to `POST /api/sales`), add:

- `customerId: linkedCustomerId ?? null` — always nullable.
- `appliedStoreCredit: appliedStoreCredit` — the decimal string; the API will parse this.

### Step 6: Update the Sale API Route

Open `src/app/api/sales/route.ts` (or equivalent from SubPhase 03.01). In the request body Zod schema, add `customerId: z.string().cuid().optional().nullable()` and `appliedStoreCredit: z.string().optional().default("0")`.

Inside the `$transaction` block, after recording the sale and payment but within the same transaction:

1. If `customerId` is present and `appliedStoreCredit` is greater than zero as a Decimal, call `redeemCredit(tenantId, customerId, appliedStoreCredit, tx)` from the customer service.
2. If `customerId` is present, call `addToSpendTotal(tenantId, customerId, saleTotal, tx)` — use `tx` here so the spend update is part of the same transaction.

Store `customerId` on the created `Sale` record by including it in the `prisma.sale.create` data object inside the transaction.

### Step 7: Verify End-to-End Flow

Manually trace the complete flow: open the POS terminal, search for a customer with a known credit balance, link them to the cart, add items, toggle "Use Store Credit", confirm Amount Due is reduced, press "Complete Sale", and then check the database via Prisma Studio to confirm that the `Sale.customerId` is set, `Customer.creditBalance` is decremented, and `Customer.totalSpend` is incremented. All three changes must reflect a single atomic transaction.

---

## Expected Output

- `src/store/cartStore.ts` (or equivalent) — extended with customer linking state and actions.
- `src/components/customers/CustomerSearchDropdown.tsx` — new debounced search dropdown component.
- `src/components/pos/CartPanel.tsx` — modified with customer section and store credit toggle.
- `src/app/api/sales/route.ts` — modified to persist `customerId` and call `redeemCredit` and `addToSpendTotal` inside the transaction.

---

## Validation

- [ ] Searching for "Silva" in the customer search shows matching customers in the dropdown within 300 ms of typing stopping.
- [ ] Selecting a customer shows their name and credit balance in the cart header.
- [ ] The × button correctly unlinks the customer and resets the store credit toggle.
- [ ] A customer with zero or negative credit balance does not show the "Use Store Credit" toggle.
- [ ] Completing a sale with store credit applied results in `Sale.customerId` being set and `Customer.creditBalance` decremented by exactly the applied amount.
- [ ] `Customer.totalSpend` is incremented by the full sale total (before credit offset) after every sale, regardless of whether store credit was applied.
- [ ] If the credit fully covers the cart total, Amount Due shows Rs. 0.00 and the sale can be completed.

---

## Notes

- The `appliedStoreCredit` in the cart state represents what the user has chosen to apply. The sale API should re-validate this amount against the live `creditBalance` at transaction time to prevent a race condition where the customer's balance was reduced by a concurrent sale. Use `applyCreditToCart` in the API route before the `$transaction` begins as a pre-flight check.
- The `addToSpendTotal` call is made with the sale's gross total (before the credit offset) because `totalSpend` tracks value transacted, not cash collected. This is consistent with how returns reduce the spend total in SubPhase 03.03.
- Re-running the cart reset action (e.g., after void or after a successful sale) must clear `linkedCustomerId`, `linkedCustomerName`, `linkedCustomerCreditBalance`, and `appliedStoreCredit` back to their defaults to prevent them from leaking into the next transaction.
