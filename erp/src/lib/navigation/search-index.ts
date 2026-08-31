import type { PermissionKey } from '@/lib/constants/permissions';

export interface NavSearchEntry {
  /** Human-readable title shown in results. */
  title: string;
  /** Absolute store route the entry navigates to. */
  path: string;
  /** Short description shown beneath the title. */
  description?: string;
  /** Extra keywords to make fuzzy search more forgiving. */
  keywords?: string[];
  /** Optional permission gate — entry is hidden if the user lacks it. */
  permission?: PermissionKey;
  /** Logical grouping used to label result sections. */
  group?: string;
  /** Marks an entry as an in-page action (button) vs a route. */
  kind?: 'page' | 'action';
}

/**
 * Searchable index of every store route plus the most notable
 * in-page actions. `permission` (when set) keeps entries invisible
 * to users whose effective permissions do not include it.
 */
export const NAV_SEARCH_INDEX: NavSearchEntry[] = [
  // ── Overview ──────────────────────────────────────────────────
  { title: 'Dashboard', path: '/dashboard', description: 'Overview of store KPIs and activity.', keywords: ['home', 'kpi', 'overview'], group: 'Overview' },
  { title: 'POS Terminal', path: '/pos', description: 'Product grid point-of-sale terminal.', keywords: ['sell', 'checkout', 'register'], group: 'Overview', permission: 'sale:create' },
  { title: 'Sales', path: '/sales', description: 'List of all sales and transactions.', keywords: ['transactions', 'receipts'], group: 'Overview' },
  { title: 'Record Sale', path: '/sales', description: 'Record a new sale transaction.', keywords: ['new sale', 'add sale', 'create sale', 'transaction'], group: 'Overview', permission: 'sale:create', kind: 'action' },
  { title: 'Returns', path: '/returns', description: 'Manage sales returns and refunds.', keywords: ['refund'], group: 'Overview' },
  { title: 'Process Return', path: '/returns', description: 'Process a sales return or refund.', keywords: ['new return', 'add return', 'create return', 'refund'], group: 'Overview', permission: 'sale:refund', kind: 'action' },
  { title: 'Shifts', path: '/staff/shifts', description: 'Manage staff shifts and openings.', keywords: ['open shift', 'close shift'], group: 'Overview' },
  { title: 'Notifications', path: '/notifications', description: 'View in-app notifications and alerts.', keywords: ['alerts'], group: 'Overview' },

  // ── Appointments ──────────────────────────────────────────────
  { title: 'Appointments Calendar', path: '/appointments', description: 'Appointments calendar and booking.', keywords: ['appointments', 'booking', 'schedule', 'calendar'], group: 'Appointments', permission: 'appointment:view' },
  { title: 'Appointment List', path: '/appointments/list', description: 'List view of all appointments.', keywords: ['appointments', 'bookings', 'list'], group: 'Appointments', permission: 'appointment:view' },
  { title: 'Appointment Services', path: '/appointments/services', description: 'Manage appointment services.', keywords: ['services', 'menu'], group: 'Appointments', permission: 'appointment:view' },
  { title: 'Appointment Settings', path: '/appointments/settings', description: 'Configure appointment booking settings.', keywords: ['booking settings', 'configuration'], group: 'Appointments', permission: 'appointment:settings:manage' },

  // ── Operations: Inventory ─────────────────────────────────────
  { title: 'Inventory', path: '/inventory', description: 'Product list with filters and bulk actions.', keywords: ['products', 'product catalog', 'catalogue', 'stock'], group: 'Operations', permission: 'product:view' },
  { title: 'Add Product', path: '/inventory/new', description: 'Create a new product.', keywords: ['create', 'new', 'product', 'add product'], group: 'Operations', permission: 'product:create', kind: 'action' },
  { title: 'Brands', path: '/brands', description: 'Manage product brands.', keywords: ['brand'], group: 'Operations', permission: 'product:view' },
  { title: 'Add Brand', path: '/brands', description: 'Create a new product brand.', keywords: ['new brand', 'add brand'], group: 'Operations', permission: 'product:view', kind: 'action' },
  { title: 'Categories', path: '/categories', description: 'Manage product categories.', keywords: ['category'], group: 'Operations', permission: 'product:view' },
  { title: 'New Category', path: '/categories', description: 'Create a new product category.', keywords: ['add category', 'new category', 'create category'], group: 'Operations', permission: 'product:view', kind: 'action' },

  // ── Operations: Purchasing / Stock ────────────────────────────
  { title: 'Purchase Orders', path: '/suppliers/purchase-orders', description: 'List of purchase orders.', keywords: ['po', 'supplier'], group: 'Operations', permission: 'supplier:view' },
  { title: 'New Purchase Order', path: '/suppliers/purchase-orders/new', description: 'Create a purchase order.', keywords: ['create', 'po'], group: 'Operations', permission: 'purchase_order:create', kind: 'action' },
  { title: 'Stock Control', path: '/stock-control', description: 'Stock overview dashboard.', keywords: ['inventory', 'levels'], group: 'Operations', permission: 'stock:view' },
  { title: 'Low Stock', path: '/stock-control/low-stock', description: 'Products at or below reorder level.', keywords: ['reorder', 'alert'], group: 'Operations', permission: 'stock:view' },
  { title: 'Adjust Stock', path: '/stock-control/adjust', description: 'Manually adjust stock levels.', keywords: ['stock adjust', 'correction', 'adjustment'], group: 'Operations', permission: 'stock:adjust', kind: 'action' },
  { title: 'Stock Movements', path: '/stock-control/movements', description: 'History of stock movements.', keywords: ['history', 'log'], group: 'Operations', permission: 'stock:view' },
  { title: 'Stock Takes', path: '/stock-control/stock-takes', description: 'Conduct and list stock counts.', keywords: ['count', 'cycle'], group: 'Operations', permission: 'stock:take' },
  { title: 'Start New Stock Take', path: '/stock-control/stock-takes', description: 'Start a new stock count session.', keywords: ['new stock take', 'add new stock take', 'add stock take', 'stock count', 'inventory count'], group: 'Operations', permission: 'stock:take', kind: 'action' },
  { title: 'Stock Valuation', path: '/stock-control/valuation', description: 'Valuation of current stock on hand.', keywords: ['value', 'worth'], group: 'Operations', permission: 'stock:valuation:view' },

  // ── Operations: People ────────────────────────────────────────
  { title: 'Customers', path: '/customers', description: 'Customer directory with search and editing.', keywords: ['clients'], group: 'Operations', permission: 'customer:view' },
  { title: 'Add Customer', path: '/customers', description: 'Create a new customer.', keywords: ['new customer', 'add customer'], group: 'Operations', permission: 'customer:create', kind: 'action' },
  { title: 'Import Customers', path: '/customers/import', description: 'Bulk-import customers from a file.', keywords: ['import', 'csv', 'upload'], group: 'Operations', permission: 'customer:view', kind: 'action' },
  { title: 'Customer Broadcast', path: '/customers/broadcast', description: 'Send broadcast messages to customers.', keywords: ['message', 'sms'], group: 'Operations', permission: 'customer:view' },
  { title: 'Suppliers', path: '/suppliers', description: 'Supplier directory.', keywords: ['vendors'], group: 'Operations', permission: 'supplier:view' },
  { title: 'Add Supplier', path: '/suppliers', description: 'Create a new supplier.', keywords: ['new supplier', 'add supplier'], group: 'Operations', permission: 'supplier:create', kind: 'action' },
  { title: 'Staff', path: '/staff', description: 'Staff directory and management.', keywords: ['employees', 'team'], group: 'Operations', permission: 'staff:view' },
  { title: 'New Staff Member', path: '/staff', description: 'Create a new staff member.', keywords: ['add staff member', 'new staff', 'add staff', 'employee'], group: 'Operations', permission: 'staff:manage', kind: 'action' },
  { title: 'Attendance', path: '/staff/timeclock', description: 'Attendance and timeclock records.', keywords: ['clock in', 'punch'], group: 'Operations', permission: 'staff:attendance:view' },
  { title: 'Staff Commissions', path: '/staff/commissions', description: 'Staff commission payouts and history.', keywords: ['commission', 'payout'], group: 'Operations', permission: 'staff:view' },

  // ── Growth ────────────────────────────────────────────────────
  { title: 'Promotions', path: '/promotions', description: 'Create and manage promotions and discounts.', keywords: ['discount', 'offer'], group: 'Growth', permission: 'promotion:create' },
  { title: 'New Promotion', path: '/promotions', description: 'Create a new promotion.', keywords: ['add promotion', 'new promotion', 'offer', 'discount'], group: 'Growth', permission: 'promotion:create', kind: 'action' },
  { title: 'Expenses', path: '/expenses', description: 'Record and manage expenses.', keywords: ['spend'], group: 'Growth', permission: 'expense:view' },
  { title: 'Add Expense', path: '/expenses', description: 'Record a new expense.', keywords: ['new expense', 'add expense', 'record expense'], group: 'Growth', permission: 'expense:create', kind: 'action' },
  { title: 'Petty Cash', path: '/petty-cash', description: 'Manage petty cash drawer funds.', keywords: ['cash', 'drawer'], group: 'Growth', permission: 'petty_cash:view' },
  { title: 'Cash Flow', path: '/expenses/cash-flow', description: 'Cash flow statement over a period.', keywords: ['cashflow'], group: 'Growth', permission: 'report:view_cashflow' },

  // ── Delivery / Orders ─────────────────────────────────────────
  { title: 'Orders', path: '/orders', description: 'List of delivery and order tickets.', keywords: ['tickets'], group: 'Delivery', permission: 'delivery:view' },
  { title: 'Deliveries', path: '/delivery', description: 'Delivery dispatch and tracking list.', keywords: ['dispatch', 'track'], group: 'Delivery', permission: 'delivery:view' },
  { title: 'Rate Card', path: '/delivery/rate-card', description: 'Configure delivery and pricing rates.', keywords: ['pricing', 'rates'], group: 'Delivery', permission: 'delivery:ratecard:manage' },
  { title: 'Packaging', path: '/delivery/packaging', description: 'Manage packaging materials stock.', keywords: ['boxes', 'materials'], group: 'Delivery', permission: 'delivery:packaging:manage' },
  { title: 'Add Item', path: '/delivery/packaging', description: 'Add a new packaging stock item.', keywords: ['add packaging stock item', 'new packaging item', 'packaging stock'], group: 'Delivery', permission: 'delivery:packaging:manage', kind: 'action' },
  { title: 'Reconciliation', path: '/delivery/reconciliation', description: 'Reconcile cash-on-delivery collections.', keywords: ['cod', 'settlement'], group: 'Delivery', permission: 'delivery:recon:view' },
  { title: 'Courier Settings', path: '/delivery/settings', description: 'Configure courier integrations.', keywords: ['courier', 'api'], group: 'Delivery', permission: 'delivery:courier:manage' },
  { title: 'Label Design', path: '/delivery/label', description: 'Customize shipping label templates.', keywords: ['template', 'print'], group: 'Delivery', permission: 'delivery:label:manage' },

  // ── Factory ───────────────────────────────────────────────────
  { title: 'Factory Dashboard', path: '/factory', description: 'Factory production overview.', keywords: ['production'], group: 'Factory', permission: 'factory:dashboard:view' },
  { title: 'Raw Materials', path: '/factory/raw-materials', description: 'Manage raw material inventory.', keywords: ['materials'], group: 'Factory', permission: 'raw_material:view' },
  { title: 'Add Raw Material', path: '/factory/raw-materials', description: 'Add a new raw material.', keywords: ['new raw material', 'add raw material'], group: 'Factory', permission: 'raw_material:create', kind: 'action' },
  { title: 'Bill of Materials', path: '/factory/bom', description: 'Manage bill of materials.', keywords: ['bom', 'recipe'], group: 'Factory', permission: 'bom:view' },
  { title: 'New BOM', path: '/factory/bom', description: 'Create a new bill of materials.', keywords: ['new bill of material', 'new bom', 'add bom', 'bill of material'], group: 'Factory', permission: 'bom:create', kind: 'action' },

  // ── Reports ───────────────────────────────────────────────────
  { title: 'Profit & Loss', path: '/reports/profit-loss', description: 'Profit and loss statement.', keywords: ['p&l', 'income'], group: 'Reports', permission: 'report:view_profit' },
  { title: 'Sales by Product', path: '/reports/sales', description: 'Sales report grouped by product.', keywords: ['sales'], group: 'Reports', permission: 'report:view_sales' },
  { title: 'Revenue Trend', path: '/reports/revenue-trend', description: 'Revenue over time.', keywords: ['trend'], group: 'Reports', permission: 'report:view_sales' },
  { title: 'Inventory Valuation', path: '/reports/inventory-valuation', description: 'Value of inventory on hand.', keywords: ['valuation'], group: 'Reports', permission: 'report:view_stock' },
  { title: 'Stock Movements Report', path: '/reports/stock-movements', description: 'Report of stock movement entries.', keywords: ['movements'], group: 'Reports', permission: 'report:view_stock' },
  { title: 'Customer Analytics', path: '/reports/customer-analytics', description: 'Customer purchase analytics.', keywords: ['customers'], group: 'Reports', permission: 'report:view_customers' },
  { title: 'Staff Performance', path: '/reports/staff-performance', description: 'Staff sales performance report.', keywords: ['performance'], group: 'Reports', permission: 'report:view_sales' },
  { title: 'Return Rate', path: '/reports/return-rate', description: 'Return rate analytics.', keywords: ['returns'], group: 'Reports', permission: 'report:view_sales' },
  { title: 'Zero-Value Audit', path: '/reports/zero-value-sales', description: 'Audit of zero-value sales.', keywords: ['zero', 'audit'], group: 'Reports', permission: 'report:view_zero_value' },
  { title: 'Recovery Performance', path: '/reports/recovery-staff-performance', description: 'COD recovery performance by staff.', keywords: ['recovery', 'cod'], group: 'Reports', permission: 'report:view_recovery' },
  { title: 'Saved Reports', path: '/reports/saved', description: 'Open previously saved report filters.', keywords: ['saved', 'filters'], group: 'Reports', permission: 'report:view_sales' },

  // ── Settings ──────────────────────────────────────────────────
  { title: 'My Account', path: '/settings/account', description: 'Your account preferences and profile.', keywords: ['profile', 'password'], group: 'Settings' },
  { title: 'Tax Settings', path: '/settings/taxes', description: 'Configure tax rates.', keywords: ['tax', 'vat'], group: 'Settings', permission: 'settings:tax' },
  { title: 'Team & Permissions', path: '/settings/users', description: 'Manage users and role permissions.', keywords: ['users', 'roles'], group: 'Settings', permission: 'settings:users' },
  { title: 'Hardware Settings', path: '/settings/hardware', description: 'Configure printers and peripherals.', keywords: ['printer', 'device'], group: 'Settings', permission: 'settings:hardware' },
  { title: 'Store Profile', path: '/settings/store', description: 'Store and business profile details.', keywords: ['business', 'profile'], group: 'Settings', permission: 'settings:store_profile' },
  { title: 'Website', path: '/settings/website', description: 'Configure the public storefront website.', keywords: ['storefront', 'theme'], group: 'Settings' },
  { title: 'Webhooks', path: '/settings/webhooks', description: 'Manage outbound webhooks.', keywords: ['hooks', 'integrations'], group: 'Settings' },
  { title: 'Audit Log', path: '/settings/audit-log', description: 'System audit trail with export.', keywords: ['logs', 'history'], group: 'Settings', permission: 'settings:view_audit_log' },

  // ── Notable actions ───────────────────────────────────────────
  { title: 'Export filtered CSV', path: '/settings/audit-log', description: 'Export the current audit log view to CSV.', keywords: ['export', 'csv', 'download', 'audit'], group: 'Actions', permission: 'settings:view_audit_log', kind: 'action' },
  { title: 'Export CSV (Reports)', path: '/reports/sales', description: 'Export the open report to CSV.', keywords: ['export', 'csv', 'report'], group: 'Actions', permission: 'report:export', kind: 'action' },
  { title: 'Save Report', path: '/reports/sales', description: 'Save the current report filters.', keywords: ['save', 'report', 'filters'], group: 'Actions', permission: 'report:export', kind: 'action' },
  { title: 'Import CSV', path: '/inventory', description: 'Import products from a CSV file.', keywords: ['import', 'csv', 'upload', 'products'], group: 'Actions', permission: 'product:import', kind: 'action' },
  { title: 'Open Shift', path: '/staff/shifts', description: 'Open a new cashier shift.', keywords: ['open', 'shift', 'start'], group: 'Actions', permission: 'shift:open', kind: 'action' },
  { title: 'Create Delivery', path: '/delivery', description: 'Create a new delivery dispatch.', keywords: ['create', 'delivery', 'new'], group: 'Actions', permission: 'delivery:create', kind: 'action' },
  { title: 'Print Labels', path: '/delivery', description: 'Print shipping labels for orders.', keywords: ['print', 'labels'], group: 'Actions', permission: 'delivery:view', kind: 'action' },
  { title: 'Print Invoices', path: '/orders', description: 'Print invoices for orders.', keywords: ['print', 'invoice'], group: 'Actions', permission: 'delivery:view', kind: 'action' },
  { title: 'Print Z-Report', path: '/pos/shift-report', description: 'Print the end-of-shift Z-report.', keywords: ['print', 'z-report', 'shift'], group: 'Actions', permission: 'sale:create', kind: 'action' },
];

/** Group entries by their `group` field, preserving order. */
export function groupNavEntries(entries: NavSearchEntry[]): Array<{
  group: string;
  entries: NavSearchEntry[];
}> {
  const order = Array.from(new Set(entries.map((e) => e.group ?? 'Other')));
  return order.map((group) => ({
    group,
    entries: entries.filter((e) => (e.group ?? 'Other') === group),
  }));
}
