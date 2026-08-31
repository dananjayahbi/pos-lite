// ── Report Configuration (single source of truth) ───────────────────────────
// Maps a report route pathname to a human-readable title and its ordered export
// columns. Used by the report layout for the Export popover, by the save-to-R2
// flow to render the generated file, and by the saved-reports list to display
// the correct format/filename metadata.

import type { ReportColumn } from "@/lib/reports/export";

export interface ReportDefinition {
  /** Human-readable report title, e.g. "Sales by Product". */
  title: string;
  /** Ordered export columns (key + display header). */
  columns: ReportColumn[];
  /** File extension used when saving/generating a report file. */
  extension: "pdf" | "csv" | "xlsx";
}

const definitions: Record<string, ReportDefinition> = {
  "/reports/profit-loss": {
    title: "Profit & Loss",
    columns: [
      { key: "Section", header: "Section" },
      { key: "Item", header: "Item" },
      { key: "Amount", header: "Amount" },
    ],
    extension: "pdf",
  },
  "/reports/sales": {
    title: "Sales by Product",
    columns: [
      { key: "Product", header: "Product" },
      { key: "Variant", header: "Variant" },
      { key: "Units Sold", header: "Units Sold" },
      { key: "Gross Revenue", header: "Gross Revenue" },
      { key: "Returns", header: "Returns" },
      { key: "Net Revenue", header: "Net Revenue" },
      { key: "% of Total", header: "% of Total" },
    ],
    extension: "pdf",
  },
  "/reports/revenue-trend": {
    title: "Revenue Trend",
    columns: [
      { key: "date", header: "Date" },
      { key: "revenue", header: "Revenue" },
      { key: "returns", header: "Returns" },
      { key: "transactions", header: "Transactions" },
    ],
    extension: "pdf",
  },
  "/reports/inventory-valuation": {
    title: "Inventory Valuation",
    columns: [
      { key: "SKU", header: "SKU" },
      { key: "Product", header: "Product" },
      { key: "Variant", header: "Variant" },
      { key: "Category", header: "Category" },
      { key: "Stock Qty", header: "Stock Qty" },
      { key: "Cost Price", header: "Cost Price" },
      { key: "Stock Value", header: "Stock Value" },
      { key: "Last Sale", header: "Last Sale" },
    ],
    extension: "pdf",
  },
  "/reports/stock-movements": {
    title: "Stock Movements",
    columns: [
      { key: "Date", header: "Date" },
      { key: "Product", header: "Product" },
      { key: "SKU", header: "SKU" },
      { key: "Movement Type", header: "Movement Type" },
      { key: "Delta", header: "Delta" },
      { key: "Qty Before", header: "Qty Before" },
      { key: "Qty After", header: "Qty After" },
      { key: "Actor", header: "Actor" },
      { key: "Reference", header: "Reference" },
    ],
    extension: "pdf",
  },
  "/reports/customer-analytics": {
    title: "Customer Analytics",
    columns: [
      { key: "rank", header: "Rank" },
      { key: "name", header: "Name" },
      { key: "phone", header: "Phone" },
      { key: "totalOrders", header: "Total Orders" },
      { key: "totalSpend", header: "Total Spend" },
      { key: "aov", header: "AOV" },
      { key: "lastVisit", header: "Last Visit" },
    ],
    extension: "pdf",
  },
  "/reports/staff-performance": {
    title: "Staff Performance",
    columns: [
      { key: "Email", header: "Email" },
      { key: "Role", header: "Role" },
      { key: "Hours Worked", header: "Hours Worked" },
      { key: "Sales Count", header: "Sales Count" },
      { key: "Total Revenue", header: "Total Revenue" },
      { key: "AOV", header: "AOV" },
      { key: "Commission Earned", header: "Commission Earned" },
      { key: "Commission Paid", header: "Commission Paid" },
    ],
    extension: "pdf",
  },
  "/reports/return-rate": {
    title: "Return Rate",
    columns: [
      { key: "category", header: "Category" },
      { key: "totalSales", header: "Total Sales" },
      { key: "totalRefunds", header: "Total Refunds" },
      { key: "returnRate", header: "Return Rate %" },
    ],
    extension: "pdf",
  },
  "/reports/zero-value-sales": {
    title: "Zero-Value Audit",
    columns: [
      { key: "saleNumber", header: "Sale #" },
      { key: "staff", header: "Issuer Staff" },
      { key: "reasonLabel", header: "Reason" },
      { key: "linkedOrderRef", header: "Linked Order" },
      { key: "customerName", header: "Recipient" },
      { key: "customerPhone", header: "Phone" },
      { key: "completedAt", header: "Timestamp" },
    ],
    extension: "pdf",
  },
  "/reports/sales-by-staff": {
    title: "Sales by Staff",
    columns: [
      { key: "Staff Name", header: "Staff Name" },
      { key: "Role", header: "Role" },
      { key: "Transactions", header: "Transactions" },
      { key: "Total Revenue", header: "Total Revenue" },
      { key: "Avg Transaction", header: "Avg Transaction" },
      { key: "Commission Earned", header: "Commission Earned" },
    ],
    extension: "pdf",
  },
  "/reports/recovery-staff-performance": {
    title: "Recovery Performance",
    columns: [
      { key: "Staff", header: "Staff" },
      { key: "Role", header: "Role" },
      { key: "Assigned Failed", header: "Assigned Failed" },
      { key: "Total Attempts", header: "Total Attempts" },
      { key: "Follow-ups", header: "Follow-ups" },
      { key: "Rescheduled", header: "Rescheduled" },
      { key: "Redelivered", header: "Redelivered" },
      { key: "Cancelled", header: "Cancelled" },
      { key: "Recovery Rate %", header: "Recovery Rate %" },
    ],
    extension: "pdf",
  },
};

export type ReportFormat = "pdf" | "csv" | "xlsx";

/** Look up a report definition by its route pathname. */
export function getReportDefinition(pathname: string): ReportDefinition | undefined {
  return definitions[pathname];
}

/**
 * Fallback column derivation: when a report route has no registered definition,
 * build columns from the keys of the first supplied row so the export and
 * save-to-storage flows still produce a usable (if unlabeled) file.
 */
export function deriveColumns(rows: Record<string, unknown>[]): ReportColumn[] {
  if (rows.length === 0) return [];
  const first = rows[0] as Record<string, unknown>;
  return Object.keys(first).map((key) => ({
    key,
    header: key.replace(/([A-Z])/g, " $1").trim().replace(/^./, (c) => c.toUpperCase()),
  }));
}

/** Resolve the columns for a report route, falling back to row-derived columns. */
export function resolveReportColumns(
  pathname: string,
  rows: Record<string, unknown>[],
): ReportColumn[] {
  const definition = getReportDefinition(pathname);
  if (definition && definition.columns.length > 0) return definition.columns;
  return deriveColumns(rows);
}

/** Resolve the display title for a report route. */
export function resolveReportTitle(pathname: string): string {
  const definition = getReportDefinition(pathname);
  if (definition) return definition.title;
  const slug = pathname.split("/").filter(Boolean).slice(-1)[0] ?? "Report";
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
