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
  amount?: string | undefined;
  fees?: string | undefined;
  status?: string | undefined;
  date?: string | undefined;
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

/** Tolerant column detection across statement variants. */
export function normalizeRow(row: Record<string, string>): RemittanceParsedRow {
  const keys = Object.keys(row);
  const lower = keys.map((k) => k.toLowerCase());

  const pick = (...names: string[]): string | undefined => {
    const idx = lower.findIndex((l) => names.some((n) => l.includes(n)));
    if (idx < 0) return undefined;
    const key = keys[idx];
    if (!key) return undefined;
    return row[key] ?? undefined;
  };

  return {
    waybill: pick("waybill", "way_bill", "airwaybill", "airway bill", "awb"),
    orderRef: pick("order_ref", "orderref", "order no", "order_no", "order_number", "orderno", "invoice", "reference", "internal_order"),
    barcode: pick("barcode", "tracking_no", "tracking_no_", "trackingid", "tracking_id", "tn"),
    amount: pick("amount", "cod", "settled", "paid", "received", "remitted"),
    fees: pick("fee", "charge", "cost", "commission", "deduction"),
    status: pick("status", "state"),
    date: pick("date", "settled_at", "time", "remittance_date"),
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
