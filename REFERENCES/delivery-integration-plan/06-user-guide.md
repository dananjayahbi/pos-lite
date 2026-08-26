# Delivery & Courier Integration — User Guide

> **App:** AyurPOS (`erp/`)
> **Feature:** Trans Express courier dispatch, tracking, rate cards, packaging, reconciliation
> **Applies to:** Phase 1 (Foundation & Dispatch) — implemented & certified 2026-08-06

This guide walks you through **using** the delivery module end-to-end. If you just
want to get going quickly, read **Section 0 (Quick Start)**.

---

## 0. Quick Start (5 steps)

1. **Log in** with the dispatch staff account:
   - Email: `dispatch@ayurpos.dev`
   - Password: `dispatch123!`
   - You land on **`/delivery`** automatically.
2. **Connect Trans Express** *(owner only)* — go to **Delivery → Courier Settings** and enter your Trans Express **staging** credentials, origin district/city, and pickup address.
3. **Sync locations** — press the **Sync Locations** button so city/district lists load.
4. **Create a delivery** — fill the recipient + address + COD, save it (goes to a *Hold* state).
5. **Dispatch it** — open the delivery, choose **Auto waybill**, dispatch. A **shipping label** prints.

That's the core flow. Everything else (rate cards, packaging, reconciliation) is optional and covered below.

---

## 1. Who Can Use It (Roles & Permissions)

The delivery module has its own permission group. Out of the box:

| Capability | Owner | Manager | Dispatch Staff |
|---|---|---|---|
| View deliveries | ✅ | ✅ | ✅ |
| Create a delivery | ✅ | ✅ | ✅ |
| Dispatch / track | ✅ | ✅ | ✅ |
| Cancel / edit | ✅ | ✅ | ✅ |
| Rate cards (view/manage) | ✅ | ✅ | ❌ |
| Courier settings (connect Trans Express) | ✅ | ❌ | ❌ |
| Reconciliation / remittance import | ✅ | ✅ | ❌ |
| Packaging stock | ✅ | ✅ | ✅ |

> **Who can configure the courier?** Only **Owner**. Dispatch staff can create,
> hold, dispatch, and track orders but **cannot** change rate cards, courier
> credentials, or reconciliation — by design.

### Where to grant permissions
**Settings → Users → Permissions.** Under the **Delivery** group you'll find toggles
like `viewDelivery`, `createDelivery`, `dispatchDelivery`, `manageRateCard`,
`manageCourierSettings`, `importRemittance`, `managePackaging`, `manageRecovery`.

---

## 2. Enabling the Module

The `delivery` module must be enabled for the tenant.

- **Primary tenant (Ayur Wellness Centre)** — already enabled by the seed.
- **Other tenants** — log in as **Super Admin** → **Tenants** → open the tenant →
  **Feature Modules** → toggle **Delivery & Courier** → Save.

If the Delivery section doesn't appear in the sidebar, the module isn't enabled
for your tenant yet.

---

## 3. Connecting Trans Express (Courier Settings)

> **Required once** before any real dispatch. Permission: **manageCourierSettings** (Owner).

Go to **Delivery → Courier Settings** (or the settings gear on the delivery page) and fill in:

| Field | What to enter |
|---|---|
| **Environment** | `STAGING` for testing, `PRODUCTION` for real orders |
| **Email** | Trans Express client login email |
| **Password** | Trans Express login password |
| **API Key** *(optional)* | Long-lived API key (preferred for production) |
| **Origin District** | Your pickup district (from the synced list) |
| **Origin City** | Your pickup city |
| **Pickup Address** | Your physical pickup address |

Then:
1. **Save** the settings.
2. Click **Sync Locations** to pull the province → district → city hierarchy from Trans Express and cache it.
3. Check the status shows **Active**.

> Passwords/API keys are **redacted** (shown as `••••••••`) — you can re-enter to change.

---

## 4. Rate Cards (Optional — sets your shipping prices)

> Permission: **manageRateCard** (Owner/Manager). Page: **Delivery → Rate Card**.

A **rate card** defines how you charge shipping. Two levels:

- **Card defaults**: base rate, extra-per-kg rate, free base weight, COD commission %, VAT %.
- **Entries** (overrides): per origin-district → destination-district/city with its own base + extra-kg.

**How shipping is quoted:** the system finds the most specific matching entry
(city → district → card default) and computes `base + extraKg × (weight − freeWeight)`.

### To use it
1. Open **Rate Card**, create/activate a card (set your base rate, e.g. `300` LKR, extra kg `50`).
2. Add entries for your common routes.
3. When you create a delivery, the **estimated shipping fee** is shown live via
   **Rate Preview** as you pick the destination.

> If no card is active, shipping fee shows as unavailable/zero — you can still
> create deliveries with a manual declared value.

---

## 5. The Delivery Lifecycle

Every order moves through this pipeline:

```
PLACED ──► PENDING_DISPATCH ──► DISPATCHED ──► IN_TRANSIT ──► OUT_FOR_DELIVERY ──► DELIVERED
              (hold buffer)         │
                                    ├──► FAILED
                                    ├──► CANCELED
                                    └──► RETURNED
```

### Statuses explained
| Status | Meaning |
|---|---|
| `PLACED` | Draft created, not yet ready |
| `PENDING_DISPATCH` | Saved and awaiting dispatch (default) |
| `HOLD` | Held for a buffer window (45 min) before auto-reminder |
| `DISPATCHED` | Waybill created at Trans Express |
| `IN_TRANSIT` / `OUT_FOR_DELIVERY` | Picked up / out with courier |
| `DELIVERED` | Delivered to customer |
| `FAILED` | Delivery attempt failed |
| `CANCELED` | Cancelled before dispatch |
| `RETURNED` | Returned to origin |

---

## 6. Creating a Delivery

**Delivery → Create Delivery** (button on the delivery list page).

Fill the form:
- **Source** — how the order originated (`POS`, `ERP_MANUAL`, `Website checkout`, `Import`).
- **Customer / Sale** *(optional)* — link to an existing customer or sale.
- **COD amount** — cash to collect on delivery (leave 0 for prepaid).
- **Declared value** *(optional)* — insurance/declared parcel value.
- **Item count** — number of items in the parcel.
- **Total weight (kg)** — parcel weight (used for rate calculation).
- **Recipient address** — full name, phone, address line(s), **district, city** (from synced locations), postal code.
- **Notes** *(optional)*.

> 💡 As you select the destination city, the **estimated shipping fee** appears
> (if a rate card is active).

**Save.** The order is now **`PENDING_DISPATCH`** (a *hold*), ready for dispatch.
An internal **order reference** is generated.

---

## 7. Dispatching (Sending to Trans Express)

1. From the delivery list, open the delivery.
2. Click **Dispatch**.
3. Choose the waybill mode:
   - **Auto waybill** — Trans Express generates the waybill number for you (recommended).
   - **Manual waybill** — you type in an existing waybill id (≥ 8 chars) if you have one.
4. Confirm.

On success:
- The order moves to **`DISPATCHED`**.
- A **shipping label** is generated and printed (see §8).
- Packaging stock is **auto-deducted** if you've set up packaging items (see §10).
- **Notifications** are sent to Owner / Manager / Dispatch Staff.

> You can only dispatch an order that is still `PENDING_DISPATCH` with no active shipment.

---

## 8. Shipping Label & Printing

Open a dispatched delivery and click **Print Label** (or the label button).

A branded shipping label opens in a new window containing:
- Brand header + origin
- **Ship-to** customer name, phone, and full address (enlarged for handlers)
- Order ref + **internal barcode** (top-right)
- **COD**, item count, weight
- A large **courier waybill barcode** (center) + waybill number

Use your browser's **Print** (Ctrl+P) or **Save as PDF** from that window.

> 💡 The label is currently a **pre-designed branded template**. There is not yet
> an admin UI to customize its layout/logo. If you need custom label design,
> see the developer notes.

---

## 9. Tracking

**Automatic** — a background poller (`/api/cron/sync-shipments`) periodically checks
each active shipment's status at Trans Express and updates the order automatically.

**Manual** — on any dispatched delivery, click **Refresh Tracking** to pull the
latest status on demand.

The **status timeline** on the delivery detail page shows every event (dispatch,
pickup, transit, out-for-delivery, delivered) with timestamps and source.

> Terminal statuses (`DELIVERED`, `CANCELED`, `RETURNED`) are no longer polled.

---

## 10. Packaging Stock (Optional)

> Permission: **managePackaging**. Page: **Delivery → Packaging**.

Track your packing supplies (polymailers, tape, bubble wrap, boxes) and auto-deduct
them when you dispatch a parcel.

### Add packaging items
Click **Add Item**:
- **Category** — `Polymailer`, `Tape`, `Label`, `Bubble wrap`, `Other`.
- **Name** — e.g. "Small polymailer".
- **Unit** — `Piece`, `Roll`, `Box`, `Meter`.
- **Quantity on hand** — current stock.
- **Low stock threshold** — alert level.
- **Auto-deduct** — when enabled, dispatching a parcel consumes one unit per parcel.
- **Consumption per parcel** — units used per parcel (default 1).

### Adjust stock
Use the **Adjust** action to add/remove stock (with a note), e.g. receiving a delivery
of new bags or taking damaged ones out.

> When stock falls below the threshold, a **low-stock notification** is raised.

---

## 11. Reconciliation & Remittance (Optional)

> Permission: **viewReconciliation** / **importRemittance** (Owner/Manager).
> Page: **Delivery → Reconciliation**.

Track COD money owed vs. settled by the courier and reconcile remittance statements.

### View the ledger
- **Ledger entries** — each shipment's expected COD, settled amount, fees, and net payout.
- **Pending COD aging** — how long COD amounts have been outstanding (buckets by age).

### Import a remittance statement
1. Go to **Reconciliation → Import**.
2. Upload the courier's remittance **CSV**.
3. The system matches rows **by waybill id** (with order-ref fallback) and:
   - Marks matching COD as **settled**.
   - Flags **discrepancies** when the settled amount differs from the expected COD.
   - Records **fees** and computes **net payout** = `COD − fees`.

**CSV column hints** (the parser accepts several common headers):
- Waybill: `waybill`, `way_bill`, `tracking`, `airwaybill`
- Amount: `amount`, `cod`, `settled`, `paid`, `received`
- Fees: `fee`, `charge`, `cost`, `commission`

> Import is **idempotent** — re-uploading the same statement won't double-count.

---

## 12. Background Jobs (Cron)

These run automatically and need no action from you:

| Job | What it does |
|---|---|
| `sync-shipments` | Polls Trans Express and updates shipment/delivery statuses |
| `clear-held-deliveries` | Flags holds whose 45-min buffer expired, notifies dispatch staff |
| `sync-locations` | Keeps the district/city cache fresh |

> Each is guarded by a `CRON_SECRET` in the environment — requests without it are rejected.

---

## 13. Roles Summary & Login Details

| Account | Email | Password | Role | Land |
|---|---|---|---|---|
| Super Admin | `superadmin@ayurpos.dev` | `changeme123!` | SUPER_ADMIN | `/superadmin/dashboard` |
| Owner (Ayur) | `owner@dilani-ayurwellness.lk` | `owner123!` | OWNER | `/dashboard` |
| Dispatch Staff | `dispatch@ayurpos.dev` | `dispatch123!` | DISPATCH_STAFF | `/delivery` |

---

## 14. Troubleshooting

| Problem | Likely cause & fix |
|---|---|
| Delivery section missing | Module not enabled for tenant → enable in Super Admin → Tenant → Feature Modules |
| Can't access Courier Settings / Rate Card | Need Owner role (or `manageCourierSettings` / `manageRateCard`) |
| **403 Insufficient permissions** on rate card/locations | You're Dispatch Staff — by design. Use an Owner account. |
| **401 Authentication required** | Not logged in — log in first |
| No cities in the address form | Run **Sync Locations** in Courier Settings |
| Dispatch fails with courier error | Courier credentials wrong, or environment is `PRODUCTION` without a valid key — check Courier Settings |
| Label doesn't print | Allow pop-ups for the site; use browser print from the label window |
| Tracking not updating | It's a background poll — press **Refresh Tracking**; if still stale check the cron is scheduled |

---

*Documentation for Phase 1. Phase 2 (website checkout & customer tracking) builds on this foundation.*
