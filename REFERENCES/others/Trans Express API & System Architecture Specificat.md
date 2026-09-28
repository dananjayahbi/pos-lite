# Trans Express API & System Architecture Specification

## 1. Executive Summary & Integration Architecture

Trans Express provides a RESTful web API designed for e-commerce stores, Enterprise Resource Planning (ERP) systems, and Warehouse Management Systems (WMS). The API facilitates automated order dispatch, address mapping, and tracking query capabilities over standard HTTP protocols using JSON bodies and Bearer Token authentication.

### Operational Environments & Base URLs

- **Staging Environment (Development & Testing):**
    - API Base URL: `https://dev-transexpress.parallaxtec.com/api`
    - Management Portal: `https://dev-transexpress.parallaxtec.com/`
- **Production Environment (Live Accounts):**
    - API Base URL: `https://portal.transexpress.lk/api`
- **Authentication Standard:** Bearer Token authentication via the standard HTTP `Authorization` header (`Authorization: Bearer <client_token>`), issued upon successful client login.

## 2. Comprehensive Capabilities Matrix

The following matrix summarizes the native capabilities supported directly by the Trans Express API versus those requiring system-level custom implementation.

| Operational Feature | Native API Support | System-Level Implementation Required? | Operational Context & Behavior |
| --- | --- | --- | --- |
| **User Authentication** | **Yes** | No | Authenticates registered client email/password and issues bearer tokens. |
| **Location Master Data** | **Yes** | No | Provides directories of Provinces, Districts, and Cities with numeric location IDs. |
| **Auto Order Creation** | **Yes** | No | Pushes single or bulk orders with system-assigned tracking/waybill numbers. |
| **Manual Waybill Assignment** | **Yes** | No | Allows merchant-assigned pre-printed or custom waybill numbers upon order creation. |
| **Flexible City Mapping** | **Yes** | No | Accepts either exact numeric `city_id` references or plain text city string names. |
| **Cash on Delivery (COD)** | **Yes** | No | Supports specified monetary collection targets (`cod` / `cod_amount`) per package. |
| **Single Package Tracking** | **Yes** | No | Returns live macro status and chronological lifecycle event history by waybill ID. |
| **Live Rate Pre-calculation** | **No** | **Yes** | API does not calculate shipping fees prior to or during order placement. |
| **Weight/Dimension Entry** | **No** | **Yes** | Creation API does not accept package physical dimensions or weight; measured post-pickup at hub. |
| **Real-time Webhooks** | **No** | **Yes** | Courier backend does not push automated HTTP callbacks upon package status updates. |
| **Order Edit / Cancel via API** | **No** | **Yes** | Shipments posted to the API cannot be edited, updated, or canceled via API endpoints. |
| **Financial Ledger / COD Payouts** | **No** | **Yes** | Settlement reports, bank payout transfers, and billing statements are restricted to the web portal. |

## 3. High-Level Native API Functional Groups

Rather than detailing endpoint structures (which will be referenced directly from the official API documentation during agent implementation), the native API capabilities fall into three core functional categories:

### 3.1 Authentication & Geographic Location Lookups

- **Client Session Management:** Validates account credentials and manages session authorization.
- **Geographic Hierarchy Services:** Provides lookups for Sri Lankan provinces, districts, and mapped city directories. This allows external systems to align location dropdowns and backend IDs with the courier routing database.

### 3.2 Dispatch & Fulfillment Injection

- **Single & Batch Orders:** Supports pushing individual orders or arrays of multiple order objects in a single API call.
- **Waybill Allocation Options:** Supports merchant-defined pre-printed waybills or automated system waybill generation.
- **City Identifier Fallbacks:** Offers flexibility to send structured numeric city IDs or plain text city string names for channels where structured IDs cannot be captured upfront.

### 3.3 Shipment Audit & Lifecycle Tracking

- **Status Querying:** Retrieves package tracking states using eight-character waybill identifiers.
- **Payload Information:** Returns customer destination metadata, courier-measured package weight (once weighed at hub), current macro status, and an array of historical status updates complete with timestamps and operator notes.

## 4. System-Level Solutions for Non-API Provided Capabilities

To build an enterprise-grade integration with Trans Express, external e-commerce platforms and ERP systems must implement architectural software layers on their own backend to bridge the native API limitations.

```
+-----------------------------------------------------------------------------------+
|                            YOUR E-COMMERCE / ERP SYSTEM                           |
|                                                                                   |
|  +------------------------+    +-----------------------+    +------------------+  |
|  | Local Rate Engine      |    | Local Address Resolver|    | Delay Queue      |  |
|  | (Matrix: Weight/Zone)  |    | (City String -> ID)   |    | (Order Hold)     |  |
|  +-----------+------------+    +-----------+-----------+    +--------+---------+  |
|              |                             |                         |            |
|              +----------------------+------+-------------------------+            |
|                                     |                                             |
|                                     v                                             |
|                     +---------------+---------------+                             |
|                     | Automated Order Dispatcher    |                             |
|                     +---------------+---------------+                             |
|                                     |                                             |
|                                     v                                             |
|                     +---------------+---------------+                             |
|                     | Scheduled Status Poll Worker  |                             |
|                     | (Cron / Redis Queue)          |                             |
|                     +---------------+---------------+                             |
|                                     |                                             |
|                                     v                                             |
|                     +---------------+---------------+                             |
|                     | COD Reconciliation Ledger     |                             |
|                     +-------------------------------+                             |
+-----------------------------------------------------------------------------------+
```

### 4.1 Dynamic Shipping Fee Calculation Engine

#### Challenge

The Trans Express API does not offer a shipping rate estimate endpoint, nor does it allow submitting item dimensions or weights during order creation.

#### Architectural Solution

1. **Local Shipping Rate Matrix Table:** Store Trans Express's official zone and city pricing rate card in your backend database. Map pricing tiers based on:
    - Origin District to Destination District/City.
    - First Kilogram Base Rate ($Rate_{base}$).
    - Additional Kilogram Incremental Rate ($Rate_{extra}$).
2. **Product Catalog Weight Management:** Enforce mandatory unit weight attributes ($w_i$) on all product SKUs in your inventory management database.
3. **Checkout Calculation Logic:** During customer cart checkout, sum total parcel weight:$$W_{total} = \sum_{i=1}^{n} (\text{weight}_i \times \text{quantity}_i)$$$$\text{Shipping Fee} = \begin{cases} Rate_{base}, & \text{if } W_{total} \le 1\text{ kg} \\ Rate_{base} + \lceil W_{total} - 1 \rceil \times Rate_{extra}, & \text{if } W_{total} > 1\text{ kg} \end{cases}$$
    
    Apply the local pricing formula:
    
4. **Master Location Sync:** Implement a scheduled monthly background job to fetch location directories and ensure local city and district options stay aligned with Trans Express's network.

### 4.2 Webhook Alternative: Scheduled Status Poller & Event Pipeline

#### Challenge

Trans Express does not provide webhook push events to alert your system when an order changes status (e.g., from `In Transit` to `Delivered`).

#### Architectural Solution

1. **Active Order Queue:** Maintain an active tracking database table containing all dispatched orders whose statuses have not reached a terminal state (`Delivered`, `Canceled`, or `Returned`).
2. **Scheduled Worker Execution:** Configure a background job runner executing at fixed intervals (e.g., every 2 to 4 hours during business operational windows).
3. **Throttled Batch Polling:** The background worker iterates through active orders and issues individual status requests using stored waybill identifiers.
4. **State Diff & Downstream Triggers:**
    - Compare returned status values against the last recorded status stored in your database.
    - If a state change occurs, update the internal database record and append event timestamps from the courier status history.
    - Trigger downstream customer notifications (e.g., sending automated SMS, email, or messaging updates upon package states like `Out for Delivery` or `Delivered`).

### 4.3 Order Edit, Cancellation, and Delay Buffer Queue

#### Challenge

Once an order payload is submitted to Trans Express, it cannot be edited, updated, or canceled via API requests.

#### Architectural Solution

1. **Fulfillment Hold Buffer:** When an order is approved on your storefront, hold the order in a local pending state for a configurable time window (e.g., 30 to 60 minutes) before executing the API dispatch call. This allows customers to correct address mistakes or cancel orders prior to transmission.
2. **Waybill Record Locking:** Once the hold window expires, execute the dispatch request and store the returned waybill tracking number permanently against the order record.
3. **Manual Escalation Pipeline:** If a cancellation or address change is requested *after* API submission, mark the local order as requiring manual courier intervention and generate an operational alert/ticket for warehouse staff to void the waybill in the web management portal.

### 4.4 Financial Settlement & COD Reconciliation Ledger

#### Challenge

Collected Cash on Delivery funds, bank transfer payouts, and courier service fee deductions are omitted from the API data structures.

#### Architectural Solution

1. **Expected Receivables Ledger:** When the background status poller detects an order state changed to `Delivered`, automatically record the order's COD value in an internal accounting ledger as `Delivered - Pending Settlement`.
2. **CSV Import Module:** Create an administrative utility to import periodic CSV deposit statements downloaded directly from the Trans Express Web Portal.
3. **Automated Reconciliation Matching Engine:**
    - Parse uploaded CSV rows by waybill or order reference numbers.
    - Match settled cash amounts in the statement against expected receivables in the local ledger.
    - Flag discrepancies (such as partial collections or uncollected COD) for review and automatically clear verified matches.

### 4.5 Address Normalization & Geographic Mapping

#### Challenge

Sending free-text city names can lead to hub misrouting or delivery delays if spelling variations occur.

#### Architectural Solution

1. **Structured Checkout Selectors:** On storefront checkouts, restrict city selection to structured dropdowns populated from location directory queries.
2. **Dual-ID Binding:** Store both `city_id` and `district_id` alongside customer shipping addresses upon order placement.
3. **Endpoint Routing Logic:** Use primary endpoints requiring numeric city IDs for verified checkout orders, reserving text-based city endpoints exclusively as fallbacks for external or manual order channels (e.g., social media or phone orders).

## 5. End-to-End Operational Lifecycle

```
[ Customer Checkout ]
        │
        ├── Calculates shipping rate via Local Rate Engine (Weight + Zone Matrix)
        └── Captures structured City ID / Address
        │
[ Order Created in Storefront / ERP ]
        │
        ├── Held in Delay Buffer Queue (e.g., 30 min hold for edits/cancellations)
        │
[ Order Released to Dispatcher ]
        │
        ├── Posts order payload to Trans Express API
        └── Saves returned Waybill ID to local database record
        │
[ Package Handed Over to Courier Hub ]
        │
        ├── Courier weighs parcel & updates system status
        │
[ Scheduled Polling Worker Running (Every 2–4 Hours) ]
        │
        ├── Queries tracking status via Waybill ID
        ├── Detects state change (e.g., In Transit -> Delivered)
        └── Triggers automated customer SMS/Email notification
        │
[ Settlement & Financial Reconciliation ]
        │
        ├── Delivery detected -> Logs COD amount as "Pending Settlement"
        └── Portal CSV uploaded -> Reconciliation engine matches and clears payout ledger
```