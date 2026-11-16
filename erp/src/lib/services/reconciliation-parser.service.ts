import "server-only";

import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Remittance statement parsers (CSV + Excel).
 *
 * Both parsers produce the SAME normalized row shape (`RemittanceParsedRow`) so
 * the downstream matching / reconciliation pipeline is file-format-agnostic.
 * Column detection is tolerant (fuzzy header matching) so variations across
 * courier / bank statement templates map to the same statement fields.
 */

export interface RemittanceParsedRow {
  waybill?: string | undefined;
  orderRef?: string | undefined;
  barcode?: string | undefined;
  /** Collected COD (what the courier says it received). */
  amount?: string | undefined;
  /** Courier deduction / delivery charge. */
  fees?: string | undefined;
  status?: string | undefined;
  date?: string | undefined;
  /** Net amount the courier says it will remit (PAYABLE column). */
  payable?: string | undefined;
  raw: Record<string, string>;
}

export type RemittanceFileType = "csv" | "xlsx" | "xls";

/** Detect the statement file type from its filename extension. */
export function detectStatementFileType(filename: string): RemittanceFileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  return null;
}

/**
 * Finds the best header for a field.
 *
 * Exact matches in candidate order win over partial matches, and candidates
 * are ordered most-specific first. That matters for real courier exports such
 * as the Trans Express "Invoice Details" sheet, where `COD` and
 * `COLLECTED COD` (or `COMMISSION` and `DELIVERY CHARGE`) both exist and a
 * naive "first header containing cod/fee" would pick the wrong column.
 */
function pickHeader(keys: string[], candidates: string[]): string | undefined {
  const normalized = keys.map((key) => key.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx >= 0) return keys[idx];
  }
  for (const candidate of candidates) {
    const idx = normalized.findIndex((key) => key.includes(candidate));
    if (idx >= 0) return keys[idx];
  }
  return undefined;
}

/** Tolerant column detection across statement variants. */
export function normalizeRow(row: Record<string, string>): RemittanceParsedRow {
  const keys = Object.keys(row);

  const pick = (...names: string[]): string | undefined => {
    const key = pickHeader(keys, names);
    if (!key) return undefined;
    const value = row[key];
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  return {
    waybill: pick(
      "waybill id",
      "waybill",
      "way_bill",
      "airwaybill",
      "airway bill",
      "awb",
      "tracking number",
    ),
    orderRef: pick(
      "order reference",
      "order_ref",
      "orderref",
      "order no",
      "order_no",
      "order_number",
      "orderno",
      "invoice no",
      "invoice",
      "reference",
      "internal_order",
    ),
    barcode: pick("barcode", "tracking_no", "trackingid", "tracking_id", "tn"),
    // Collected COD is the money the courier reports receiving; prefer the
    // explicit "collected" column over the order's COD value when both exist.
    amount: pick(
      "collected cod",
      "cod amount",
      "collected",
      "settled amount",
      "settled",
      "amount",
      "cod",
      "paid",
      "received",
      "remitted",
    ),
    fees: pick(
      "delivery charge",
      "courier charge",
      "deduction",
      "fee",
      "charge",
      "commission",
      "cost",
    ),
    status: pick("delivery status", "status", "state"),
    date: pick("order date", "delivery date", "settled_at", "settled at", "date", "time", "remittance date"),
    payable: pick("payable", "net payout", "net amount", "net payable"),
    raw: row,
  };
}

/** Parse a CSV statement into normalized rows. */
export function parseRemittanceCsv(csv: string): RemittanceParsedRow[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data.map(normalizeRow);
}

/**
 * Parse an Excel (.xlsx/.xls) workbook into normalized rows. Reads the first
 * (or configured) sheet, converts rows to header-keyed objects, and normalizes
 * them to the shared statement-row shape.
 */
export function parseRemittanceExcel(buffer: ArrayBuffer | Buffer): RemittanceParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  // header:1 turns the first row into object keys.
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  return rows.map(normalizeRow);
}

/**
 * Parse a remittance statement file by dispatching on its detected type.
 * Returns the normalized rows; throws a clear error for unsupported types.
 */
export function parseRemittanceFile(filename: string, buffer: Buffer): RemittanceParsedRow[] {
  const type = detectStatementFileType(filename);
  if (type === null) {
    throw new Error("Unsupported file type. Upload a .csv, .xlsx, or .xls remittance statement.");
  }
  if (type === "csv") {
    return parseRemittanceCsv(buffer.toString("utf-8"));
  }
  return parseRemittanceExcel(buffer);
}
