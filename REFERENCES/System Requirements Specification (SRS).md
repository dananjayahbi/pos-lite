# System Requirements Specification (SRS)

**Client/Brand:** Ruhunu Wedagedara (Ayurvedic Products)

## 2. System Modules & Functional Requirements

### Module 1: Customer-Facing Front-End (Web & Mobile)

#### 1.1 Product Catalog & Categorization

- **Categorized Display:** Organized hierarchy for Ayurvedic products (e.g., Medicinal Oils, Herbal Ointments, Traditional Decoctions, Wellness Products).
- **Detailed Product Pages:**
    - Active Ingredients listing.
    - Usage instructions & dosage guidelines.
    - Health benefits & safety precautions/warnings.
- **Search & Dynamic Filtering:** Filter products by price range, health concern/need, product type, or category.

#### 1.2 Localization & User Experience

- **Multilingual Support:** Fully bilingual platform in **Sinhala** and **English** (with structural support for Tamil).
- **Mobile-Responsive Design:** Optimized user interface and experience across smartphones, tablets, and desktop devices.
- **Instant Support:** Floating **WhatsApp Chat Button** for direct customer inquiry routing.

### Module 2: Order Management & Checkout

#### 2.1 Checkout Process

- **Streamlined Cart & Checkout:** Quick one-page or multi-step checkout with minimal friction.
- **Payment Options:**
    - **Online Payment Gateway:** Credit Card / Debit Card integration.
    - **Cash on Delivery (COD):** Integrated standard checkout option for island-wide delivery in Sri Lanka.

#### 2.2 Live Order Tracking

- **Self-Service Order Status:** Customers can input their Order ID or Phone Number to view real-time delivery status directly on the portal.

### Module 3: Logistics & Third-Party Courier Integration

#### 3.1 Courier API Integration

- **Automated Dispatch Integration:** Seamless API connectivity with local courier services (e.g., Domex, PromptX, Koombiyo).
- **Automated Data Sync:** Auto-push customer order details (address, contact, COD value) to the selected courier system upon dispatch approval.
- **Dynamic Delivery Fee Calculation:** Auto-calculate shipping fees based on destination area and parcel weight/dimensions.

### Module 4: Financial Reconciliation & Courier Payout Engine

#### 4.1 Remittance & Statement Upload

- **CSV/Excel Remittance Import:** Interface to upload weekly/monthly Payout Statements provided by courier companies.
- **Automated Reconciliation Engine:** System auto-matches uploaded statement rows against internal orders using Order ID / Tracking Barcode.
    - *Status Matching:* Validates whether the order was flagged as Delivered and if funds received match expected amounts.
    - *Discrepancy Identification:* Automatically flags unpaid orders, underpaid amounts, or unauthorized deductions.

#### 4.2 Fee & Commission Deductions Management

- **Courier Fee Configuration:** Setup pre-configured rate cards per courier company (Delivery Fee, COD Commission %, VAT Rate).
- **Net Profit Calculation:** Formula applied automatically per order:
$$\text{Net Payout} = \text{Gross Order Value} - (\text{Delivery Fee} + \text{COD Commission} + \text{VAT})$$
- **Financial Accuracy Audit:** System verifies if courier deductions match pre-configured contract terms.

#### 4.3 Pending COD & Dispute Dashboard

- **Aging & Pending COD Tracker:** Dedicated visual dashboard displaying delivered orders where funds have not been remitted by the courier beyond the allowed credit period (flagged in **RED**).
- **Dispute Flagging Engine:** Ability to create dispute tickets for missing COD payments or calculation errors to send back to the courier account manager.

### Module 5: Customer Contact Export Engine

- **Contact Auto-Sync & Sheet Export:** Automatically compile and stream customer phone numbers into a centralized contact list and exportable Excel/Google Sheet format on a daily schedule for marketing/SMS automation.

### Module 6: CRM & Repeat Customer Tracking

#### 6.1 Visual Identification System

- **Loyalty Badges & Icons:** Display a prominent **Gold Star (⭐️)** or **Repeat Badge (🔁)** next to customer names in order lists and search results for customers with $\ge 2$ historical orders.

#### 6.2 Filter & Analytics

- **Dedicated "Repeat Buyers" Tab:** Filter tab providing a list of loyal customers.
- **Customer Value Metrics:** Displays order frequency count, total lifetime spend, preferred product categories, and last purchase date.

### Module 7: Office Packaging Inventory Module

#### 7.1 Dedicated Office Inventory

- **Tracked Packaging Items:**
    - Courier Bags / Polymailers (segregated by size: S, M, L).
    - Adhesive Packaging Tapes (Clear, Printed, Fragile).
    - Shipping Labels & Thermal Barcode Stickers.
    - Bubble Wrap Rolls.

#### 7.2 Access Control & Auto-Deduction

- **Office-Only View:** Dedicated dashboard visible strictly to office/dispatch staff (concealing factory raw materials).
- **Auto-Deduction on Dispatch:** Automatically deduct packaging inventory units based on order volume upon dispatch (e.g., 50 dispatched parcels = 50 Polymailers + 50 Thermal Labels deducted).
- **Low Stock Alerts:** Automatic notifications sent to purchasing officers when packaging stock falls below predefined thresholds (e.g., $< 50$ polymailers).

### Module 8: Factory Store & Raw Materials Module

#### 8.1 Raw Material Inventory Management

- **Tracked Material Categories:**
    - Bulk Herbal Oils & Liquid Drums (Liters).
    - Raw Medicinal Powders & Dry Herbs (Kilograms).
    - Preservatives, Base Ingredients & Processing Chemicals.

#### 8.2 Production Integration (BOM Auto-Deduction)

- **Factory-Only Dashboard:** Strict role-based view for factory managers showing raw stock levels (concealed from office staff).
- **Bill of Materials (BOM) Auto-Deduction:** When a batch of finished goods is logged into the system (e.g., 500 bottles of Ayurvedic Oil produced), the system auto-deducts the required ratio of raw materials based on the product’s registered recipe (BOM).
- **Critical Stock Threshold Alerts:** Automatic "Low Raw Material Alert" triggers sent to factory management and procurement when raw ingredients breach minimum safety levels.

### Module 9: Traded & Resale Goods Module

#### 9.1 Wholesale & Finished Goods Management

- **Direct Stock-In (GRN / PO):** Module to register ready-made products sourced from third-party suppliers (e.g., PasPanguwa packets, imported herbal formulations).
- **Direct Inventory Entry:** Stock added straight to inventory without requiring BOM/factory manufacturing cycles.

#### 9.2 Expiry & Batch Control

- **Batch Numbering & Expiry Dates:** Mandatory batch ID and expiration date assignment upon receipt.
- **Unified Sales Visibility:** Integrated seamlessly with online store and POS stock feeds, featuring real-time quantity monitoring and low stock alerts.

### Module 10: Point of Sale (POS) / Counter Sale Module

#### 10.1 Quick Billing Interface

- **Barcodes & Fast Search:** Optimized POS terminal allowing instant item lookup via barcode scanning or quick name search for both manufactured and traded products.
- **Receipt Printing:** Automatic thermal receipt output adhering to retail printing standards.

#### 10.2 Walk-in CRM Data Capture

- **Mandatory Customer Contact Fields:** Compulsory input for Customer Name and Mobile Number prior to finalizing a transaction (feeding into the central CRM/SMS list).

#### 10.3 Real-Time Stock & Cash Settlement

- **Payment Methods:** Support for Cash, Credit/Debit Card, and LankaQR payments.
- **Instant Stock Deduction:** Immediate deduction of finished goods inventory upon sale completion.
- **Daily Sales & Cash Reconciliation:** End-of-day daily cash drawer report detailing total sales broken down by payment mode.

### Module 11: Zero-Value Order (Rs. 0) Verification & Audit

#### 11.1 Reason Selection Mandate

- **Required Classification:** Attempting to process an order with a total value of $\text{Rs. } 0$ requires selecting a validated reason from a mandatory drop-down menu:
    1. *Bank Payment (Advance Paid / Direct Bank Transfer)*
    2. *Product Replacement / Exchange*
    3. *Complimentary / Free Promotional Gift*

#### 11.2 Mandatory Linkage for Replacements

- **Previous Order Validation:** If "Product Replacement" is selected, the system requires inputting the **Original Order ID / Barcode**. The system will block order creation without a valid historical reference to prevent fraud.

#### 11.3 Fraud Audit Dashboard

- **Owner’s Daily Audit Tab:** Dedicated management report highlighting:
    - All $\text{Rs. } 0$ orders issued in the last 24 hours.
    - Issuer Staff Name, Selected Reason, Linked Previous Order ID, and Recipient Details.

### Module 12: Petty Cash Management Module

#### 12.1 Fund Allocation & Log

- **Petty Cash Balance Tracking:** Configurable initial opening balance (e.g., $\text{Rs. } 30,000$).
- **Manager Expense Entry:** Form to record daily operational expenses:
    - Date, Expense Category/Description (e.g., Staff meals, tea/sugar, office stationery).
    - Amount spent.
    - Optional receipt photo/scan upload.

#### 12.2 Owner Supervision & Balance Calculation

- **Real-time Balance Equation:**$$\text{Current Petty Cash Balance} = \text{Initial Allocation} - \text{Total Logged Expenses}$$
- **Low Cash Alerts:** Automated alert sent to the business owner when petty cash falls below a set minimum threshold (e.g., $< \text{Rs. } 5,000$).
- **Exportable Audit Trail:** Expense reports exportable in PDF/Excel format for period-end accounting.

### Module 13: Invoice & Custom Label Printing Engine

#### 13.1 Layout & Branding

- **Prominent Brand Header:** Centered or top-left high-resolution **Ruhunu Wedagedara** logo placement on shipping labels and invoices.

#### 13.2 Delivery Accuracy Layout

- **Enlarged Customer Info:** Customer Name, Phone Number, and Shipping Address printed in bold, enlarged typography for easy reading by courier dispatch handlers.
- **Dual Barcode Display:**
    1. *Top-Right Corner:* For quick internal office scanning and packing verification.
    2. *Center Shipping Label Area:* Large Barcode/QR code for courier scanning.

### Module 14: Failed Order & Return Recovery Management

#### 14.1 Daily Failed Orders Queue

- **Automated Failure Feed:** API-driven feed auto-populating orders marked as "Returned to Branch Failed" by the courier service.
- **Courier Failure Reason Display:** Clear tag indicating reason provided by courier rider (e.g., *Customer Phone Switched Off, Wrong Address, Postponed Delivery, Customer Refused*).

#### 14.2 Re-Engagement & Redelivery Workflow

- **Follow-up Call Log:** Office staff call-back workflow to contact customers and update status.
- **Action Triggers:**
    - **Redeliver Button:** Reschedules delivery date and re-pushes order payload via courier API.
    - **Permanent Cancel:** Marks item as returned to stock, updating warehouse inventory levels.

#### 14.3 Lifetime Tracking & Staff Audit

- **Lifetime History Trail:** Permanent audit trail preserved for any order initially marked as failed but subsequently converted to "Delivered".
- **Staff Performance Metrics:** Performance dashboard tracking recovery performance per staff member:
    - Total assigned failed orders.
    - Successfully recovered/delivered orders.
    - Permanently cancelled orders.

### Module 15: Security, RBAC & Audit Trails

#### 15.1 Role-Based Access Control (RBAC)

| Role | Access Permissions | Restricted Areas |
| --- | --- | --- |
| **Admin / Owner** | Full Access (All modules, financial reports, system setup, user logs). | None |
| **Office / Dispatch Staff** | Order Processing, Courier API, Packaging Stock, POS, Customer Lists. | Financial Reports, Courier Reconciliation, Factory Raw Materials. |
| **Factory Manager** | Factory Store Raw Materials, Production Logging, BOM Configuration. | Financials, Customer CRM, Sales Orders, POS. |

#### 15.2 System Activity & Audit Trail

- **Silent System Logging:** Automatic, non-editable logging of all user activities across the platform (e.g., order modifications, price overrides, stock manual adjustments, order cancellations).
- **Audit Inspection:** Owner capability to view full historical change logs per order or inventory item, detailing **Who**, **What**, **When**, and **Prior Value**.