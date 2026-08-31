// ── Server-Side Report File Generators ─────────────────────────────────────
// Generates report files (CSV / Excel / PDF) as Node Buffers. Used by the
// save-report API routes to persist a generated artifact to object storage.
// These helpers are Node-only and must never be imported into client code.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportColumn } from "@/lib/reports/export";

export interface ReportFileResult {
  /** Raw file bytes suitable for upload to object storage. */
  buffer: Buffer;
  /** MIME type for the generated file. */
  contentType: string;
  /** Recommended file extension (without leading dot). */
  extension: "csv" | "xlsx" | "pdf";
}

const isBrowser = typeof window !== "undefined";

function assertNode(): void {
  if (isBrowser) {
    throw new Error("generate-report is a server-only module");
  }
}

function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── CSV ────────────────────────────────────────────────────────────────────

export function generateCSV(
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
): ReportFileResult {
  assertNode();
  const headerLine = columns.map((c) => escapeCSVValue(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCSVValue((row[c.key] as string | number | null) ?? null)).join(","),
  );
  const csv = [headerLine, ...dataLines].join("\r\n");
  const buffer = Buffer.from("\uFEFF" + csv, "utf8");
  return { buffer, contentType: "text/csv;charset=utf-8", extension: "csv" };
}

// ── Excel (XLSX) ───────────────────────────────────────────────────────────

export function generateXLSX(
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  sheetName: string,
): ReportFileResult {
  assertNode();
  const aoa: (string | number | null)[][] = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => (row[c.key] as string | number | null) ?? null)),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    buffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  };
}

// ── PDF ────────────────────────────────────────────────────────────────────

export function generatePDF(
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  title: string,
  dateRange: string,
): ReportFileResult {
  assertNode();
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header block
  doc.setFontSize(16);
  doc.setTextColor(59, 47, 47);
  doc.text(`AyurPOS — ${title}`, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(107, 91, 91);
  doc.text(dateRange, 40, 56);
  doc.setDrawColor(200, 149, 108);
  doc.setLineWidth(1.5);
  doc.line(40, 64, pageWidth - 40, 64);

  const body = rows.map((row) => columns.map((c) => String(row[c.key] ?? "")));

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body,
    startY: 76,
    margin: { left: 40, right: 40, top: 40, bottom: 40 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      overflow: "linebreak",
      textColor: [59, 47, 47],
    },
    headStyles: {
      fillColor: [200, 149, 108],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [250, 245, 240] },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(153, 153, 153);
    doc.text(`Generated: ${new Date().toLocaleString()}  ·  Page ${i} of ${pageCount}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, {
      align: "right",
    });
  }

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, contentType: "application/pdf", extension: "pdf" };
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

export type GeneratedFormat = "csv" | "xlsx" | "pdf";

export function generateReportFile(
  format: GeneratedFormat,
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  title: string,
  dateRange: string,
): ReportFileResult {
  switch (format) {
    case "csv":
      return generateCSV(rows, columns);
    case "xlsx":
      return generateXLSX(rows, columns, title);
    case "pdf":
      return generatePDF(rows, columns, title, dateRange);
  }
}
