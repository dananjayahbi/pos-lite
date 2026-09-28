// ── Report Export Utilities (zero external dependencies) ────────

export type ReportColumn = { key: string; header: string; width?: number };
export type ReportRow = Record<string, string | number | null>;

// ── Helpers ─────────────────────────────────────────────────────

function escapeCSVValue(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTimestamp(): string {
  return new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── CSV Export ──────────────────────────────────────────────────

export async function exportToCSV(
  rows: ReportRow[],
  columns: ReportColumn[],
  filename: string,
): Promise<void> {
  const headerLine = columns.map((c) => escapeCSVValue(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCSVValue(row[c.key] ?? null)).join(","),
  );
  const csv = [headerLine, ...dataLines].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

// ── Excel Export (HTML table → .xls) ───────────────────────────

/**
 * M34-02 (BUG-77): the pure HTML builder, split out of `exportToExcel` so the
 * escaping of the sheet name, headers and cells is directly unit-testable
 * without a DOM. Every interpolated value goes through `escapeHTML`.
 */
export function buildXlsxHtml(
  sheetName: string,
  columns: ReportColumn[],
  rows: ReportRow[],
): string {
  const thCells = columns
    .map(
      (c) =>
        `<th style="background:#c8956c;color:#fff;padding:8px 12px;font-weight:600;border:1px solid #ddd;">${escapeHTML(c.header)}</th>`,
    )
    .join("");

  const bodyRows = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? "#fff" : "#faf5f0";
      const cells = columns
        .map(
          (c) =>
            `<td style="padding:6px 12px;border:1px solid #ddd;background:${bg};">${escapeHTML(String(row[c.key] ?? ""))}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${escapeHTML(sheetName)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body><table border="1"><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table></body>
</html>`.trim();
}

export async function exportToExcel(
  rows: ReportRow[],
  columns: ReportColumn[],
  sheetName: string,
  filename: string,
): Promise<void> {
  const html = buildXlsxHtml(sheetName, columns, rows);

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  triggerDownload(blob, filename.endsWith(".xls") ? filename : `${filename}.xls`);
}

// ── PDF Export (printable HTML page) ───────────────────────────

/**
 * M34-02 (BUG-77): the pure printable-HTML builder, split out of `exportToPDF`
 * so the title/dateRange/header/cell escaping is directly unit-testable. This is
 * the path M34-02 flags as the real sink — `generateReportFile` renders saved
 * reports server-side, so an unescaped saved-report name would land in HTML.
 */
export function buildPrintHtml(
  reportTitle: string,
  dateRange: string,
  columns: ReportColumn[],
  rows: ReportRow[],
): string {
  const thCells = columns
    .map(
      (c) =>
        `<th style="background:#c8956c;color:#fff;padding:8px 12px;text-align:left;font-size:13px;">${escapeHTML(c.header)}</th>`,
    )
    .join("");

  const bodyRows = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? "#fff" : "#faf5f0";
      const cells = columns
        .map(
          (c) =>
            `<td style="padding:6px 12px;border-bottom:1px solid #e8e0d8;background:${bg};font-size:13px;">${escapeHTML(String(row[c.key] ?? ""))}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const timestamp = formatTimestamp();

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHTML(reportTitle)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #3b2f2f; padding: 32px; }
  .header { margin-bottom: 24px; border-bottom: 2px solid #c8956c; padding-bottom: 16px; }
  .header h1 { font-size: 22px; font-weight: 700; color: #3b2f2f; }
  .header p { font-size: 13px; color: #6b5b5b; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .footer { font-size: 11px; color: #999; text-align: right; border-top: 1px solid #e8e0d8; padding-top: 8px; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<div class="header">
  <h1>AyurPOS — ${escapeHTML(reportTitle)}</h1>
  <p>${escapeHTML(dateRange)}</p>
</div>
<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>
<div class="footer">Generated: ${escapeHTML(timestamp)}</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}
export async function exportToPDF(
  reportTitle: string,
  dateRange: string,
  rows: ReportRow[],
  columns: ReportColumn[],
  filename: string,
): Promise<void> {
  const html = buildPrintHtml(reportTitle, dateRange, columns, rows);

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

// ── HTML escaping ───────────────────────────────────────────

/** M34-02 (BUG-77): exported so the XSS-sink audit can assert it directly. */
export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
