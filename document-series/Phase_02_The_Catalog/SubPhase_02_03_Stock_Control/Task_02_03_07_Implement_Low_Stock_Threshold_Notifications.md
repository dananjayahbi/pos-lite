# Task 02.03.07 — Implement Low Stock Threshold Notifications

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.07 |
| Task Name | Implement Low Stock Threshold Notifications |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Medium |
| Dependencies | Task_02_03_02 complete |
| Output Paths | prisma/schema.prisma (modified), src/lib/inventory.service.ts (modified), src/components/notifications/NotificationPopover.tsx, src/app/api/notifications/route.ts, src/app/api/notifications/[id]/read/route.ts, src/app/api/notifications/read-all/route.ts |

---

## Objective

Implement the full in-app notification system for low stock threshold alerts. When any stock adjustment causes a variant's quantity to reach or drop below its lowStockThreshold, the system must atomically create NotificationRecord entries for all OWNER and MANAGER users of the tenant, show an immediate toast to the adjusting user, and display persistent in-app notification entries accessible via a bell icon in the top navigation bar. This task also covers the notification model schema, API routes, and the notification UI popover.

---

## Instructions

### Step 1: Verify or Add the NotificationRecord Model to the Prisma Schema

Open prisma/schema.prisma and check whether a NotificationRecord model already exists (it may have been defined during Phase 1 infrastructure work). If it exists, verify it has all the required fields listed below. If it does not exist, add it.

The NotificationRecord model requires the following fields:

The id field is a CUID primary key with autoincrement via @default(cuid()).

The tenantId field is a string with a foreign key relation to the Tenant model.

The recipientId field is a string with a foreign key relation to the User model — this identifies which staff member receives this notification.

The type field uses a NotificationType enum. Define the NotificationType enum in the schema with these values: LOW_STOCK_ALERT, STOCK_TAKE_SUBMITTED, STOCK_TAKE_APPROVED, STOCK_TAKE_REJECTED, and SYSTEM_ALERT.

The title field is a non-nullable string.

The body field is a non-nullable string.

The relatedEntityType field is an optional string used to identify what kind of record triggered this notification — for example the string value "ProductVariant" or "StockTakeSession".

The relatedEntityId field is an optional string containing the ID of the related record, enabling deep links in the notification UI.

The isRead field is a boolean with a default of false.

The createdAt field is a DateTime with @default(now()).

Add database indexes on the combination of [tenantId, recipientId, isRead] and on [tenantId, recipientId, createdAt] to support efficient unread count queries and sorted listing queries.

If the model did not exist, run a Prisma migration named "add_notification_records". Regenerate the Prisma client.

### Step 2: Extend adjustStock in inventory.service.ts

Open src/lib/inventory.service.ts and locate the adjustStock function. After the stock adjustment logic executes and the resulting newQuantity is determined, add the low-stock notification logic inside the same Prisma transaction.

The logic is as follows: if the resulting stockQuantity is greater than zero but less than or equal to the variant's lowStockThreshold, or if the resulting stockQuantity is exactly zero (out-of-stock condition), fetch all User records for the tenant whose role is OWNER or MANAGER. For each such user, create one NotificationRecord within the same transaction.

The notification fields for a low stock alert are:
- type: LOW_STOCK_ALERT
- title: the product name followed by the variant SKU in brackets, then "is low on stock" — formatted as "[Product Name — SKU] is low on stock"
- body: a multi-part message stating the current stock level, the threshold value, and who made the adjustment. Example: "Current stock: 2 units. Threshold: 5 units. Adjusted by: Priya Senanayake."
- relatedEntityType: "ProductVariant"
- relatedEntityId: the variantId

All NotificationRecord creates must be part of the same Prisma transaction as the StockMovement insert and the ProductVariant stockQuantity update. If the transaction rolls back for any reason, no orphaned notifications must be created.

If lowStockThreshold is zero or null on the variant (meaning no threshold is configured), skip the notification creation entirely.

### Step 3: Implement the Same Pattern in bulkAdjustStock

Apply the same low-stock notification logic in bulkAdjustStock. After processing all variants, collect all variants whose resulting quantity is at or below threshold, then create the notifications in a single batch within the transaction. Group notifications by recipient — if 8 variants drop below threshold in one bulk operation, each OWNER still receives 8 individual notifications (one per variant) rather than a single aggregate notification. This maintains full traceability.

### Step 4: Build the GET /api/notifications API Route

Create src/app/api/notifications/route.ts. This route is authenticated and requires no specific RBAC permission beyond being an active tenant user — all roles can receive notifications.

The GET handler returns unread notifications for the authenticated user within their tenant. Query parameters: limit (default 10, maximum 50) and includeRead (boolean, default false). The response shape is the standard envelope: success, data containing an array of notification objects and a total unread count.

Each notification object returned should include: id, type, title, body, relatedEntityType, relatedEntityId, isRead, and createdAt. Order by createdAt descending.

### Step 5: Build the PATCH /api/notifications/[id]/read Route

Create src/app/api/notifications/[id]/read/route.ts. The PATCH handler marks a single notification as read. Validate that the notification exists, belongs to the authenticated user's tenant, and has the authenticated user as the recipient. Update isRead to true. Return the updated notification.

### Step 6: Build the PATCH /api/notifications/read-all Route

Create src/app/api/notifications/read-all/route.ts. The PATCH handler marks all unread notifications for the authenticated user as read using a Prisma updateMany operation scoped strictly to the authenticated user's tenantId and recipientId. Return a count of records updated.

### Step 7: Create TanStack Query Hooks for Notifications

Create a useGetNotifications hook in src/hooks/useGetNotifications.ts. This hook calls GET /api/notifications and returns the notifications list and the unread count. Set the refetch interval to 30 seconds so the notification count badge in the UI stays reasonably current. Use the query key ["notifications", userId] so the cache is user-scoped.

### Step 8: Build the NotificationPopover Component

Create src/components/notifications/NotificationPopover.tsx as a client component.

The trigger element is a bell icon from Lucide. When the unread count is greater than zero, overlay a small circular badge on the top-right of the bell icon. The badge background uses the danger semantic colour (#9B2226). The badge text is the unread count (abbreviated to "9+" if the count exceeds 9). The bell icon size should match the other navigation icons in the top bar.

The bell icon trigger opens a ShadCN Popover on click. The popover panel is approximately 380px wide on desktop.

The popover panel header reads "Notifications" in Inter semibold with a "Mark all as read" text link aligned to the right using the terracotta colour. Clicking "Mark all as read" calls PATCH /api/notifications/read-all and invalidates the notifications query.

The notification list renders up to 10 unread notifications in chronological order (newest first). Each notification item shows: a type icon on the left (a warning triangle for LOW_STOCK_ALERT, a clipboard for STOCK_TAKE_SUBMITTED, a check mark for STOCK_TAKE_APPROVED, an X for STOCK_TAKE_REJECTED, and an info icon for SYSTEM_ALERT), the notification title in bold Inter medium beside the icon, the notification body in small muted text below the title, and a relative timestamp in the smallest muted text at the right edge of the item (e.g. "5 minutes ago", "2 hours ago", "Yesterday").

Each notification item that has a relatedEntityId renders as a clickable link navigating to the relevant entity. LOW_STOCK_ALERT notifications link to the low-stock list page filtered to that variant. STOCK_TAKE notifications link to the relevant session's detail or review page. Clicking a notification also marks it as read via PATCH /api/notifications/[id]/read.

At the bottom of the popover, render a "View all notifications →" link that navigates to a full notifications page at /dashboard/[tenantSlug]/notifications. This full page is a simple read-only list of all notifications (including read ones) — implementation detail is out of scope for this task but the route should be stubbed to avoid 404 errors.

Place the NotificationPopover in the top navigation bar layout component alongside the user avatar and other header actions.

### Step 9: Show an Immediate Toast on Low Stock Trigger

When the stock adjustment form in Task_02_03_02 receives a success response from the API and the response includes a lowStockTriggered flag (a field the API returns when the threshold was breached), display an additional Sonner toast immediately after the primary "Stock updated" toast. This second toast uses the warning colour variant and reads: "[Product Name — SKU] is low on stock. Current stock: X" with a link "View Low Stock →" to the low-stock list page.

This immediate toast is in addition to the persistent NotificationRecord created server-side — it provides immediate in-session feedback to the adjusting user even before they notice the notification bell glow.

---

## Expected Output

A complete notification infrastructure: a database model, service-layer notification creation wired into stock adjustment transactions, three API routes for managing notifications, a bell icon popover component in the top navigation, and an immediate low-stock toast from the adjustment form. All notifications are tenant-scoped and recipient-specific.

---

## Validation

- Adjust a seeded variant's stock to exactly its lowStockThreshold. Confirm a warning toast appears immediately in the UI and a NotificationRecord is created in the database for the OWNER user.
- Adjust the same variant one unit lower. Confirm another notification is created (further drop below threshold).
- Adjust stock back above threshold. Confirm no new notification is created (notifications only fire on threshold breach, not on recovery).
- Log in as the OWNER. Open the notification popover. Confirm the LOW_STOCK_ALERT notification appears with the correct product name, SKU, and body text.
- Click "Mark all as read". Confirm all notifications are marked read and the badge clears.
- Verify the Prisma transaction atomicity: simulate an API error mid-transaction (via a test scenario that throws after the stock update but before the notification creates — this can be done with a deliberate test seam). Confirm no notification is created when the transaction is rolled back.

---

## Notes

- The NotificationRecord creation occurs inside the Prisma transaction in inventory.service.ts. Never create notifications outside the transaction — an "orphaned" notification for a failed adjustment is confusing and incorrect.
- The 30-second refetch interval on the notifications hook strikes a balance between freshness and API request volume. In Phase 6, this can be replaced with a WebSocket or Server-Sent Events push mechanism.
- For tenants with many OWNER and MANAGER users, a single stock adjustment could create many notification records. Ensure the bulk insert uses Prisma createMany for efficiency rather than iterating with individual create calls.
- The full notifications page (/dashboard/[tenantSlug]/notifications) is stubbed in this task. A full implementation with filtering, pagination, and type filtering is a Phase 3 or Phase 5 enhancement.
