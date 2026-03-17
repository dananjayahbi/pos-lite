# Task 05.01.11 — Build Report Export Utilities

## Metadata

| Field        | Value                                                                          |
|--------------|--------------------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                                |
| Phase        | 05 — The Platform                                                              |
| Complexity   | Moderate                                                                       |
| Dependencies | 05.01.02 (ReportContext), pnpm add recharts, pnpm add @react-pdf/renderer, pnpm add xlsx; papaparse already installed |

---

## Objective

Create `src/lib/reports/export.ts` with three export functions — `exportToPDF`, `exportToCSV`, and `exportToExcel` — that each trigger a browser download of the current report's data, and wire them into the `ReportLayout` export dropdown.

---

## Context

Report data is only valuable if it can leave the system. Buyers, accountants, and bank managers all expect physical or digital documents. The export utilities sit in a standalone module so every report page can reuse them without duplication. The `ReportContext` decouples the data source from the export trigger: the `ReportLayout` dropdown does not need to know which report is active — it just reads `reportData` from context.

---

## Instructions

**Step 1: Install required packages**

Run `pnpm add @react-pdf/renderer` and run `pnpm add xlsx` in the project root. Papaparse is already installed from earlier phases. These three libraries handle the three export formats respectively.

**Step 2: Define shared types**

At the top of `src/lib/reports/export.ts`, define two types without using any code block syntax in this document. The first type, `ReportColumn`, has fields: `key` (a string that is the property name in the data object), `header` (the display label for the column header), and `width` (an optional number specifying the column width hint for Excel and PDF). The second type, `ReportRow`, is `Record<string, string | number | null>` — a plain object where every value is a string, number, or null.

**Step 3: Implement exportToCSV**

Define an async function `exportToCSV(rows: ReportRow[], columns: ReportColumn[], filename: string): void`. Use `Papa.unparse` from papaparse. Pass an object with `fields` as the array of `column.header` strings and `data` as the rows mapped to ordered arrays of values matching the column `key` order. This ensures columns appear in the defined order regardless of object key ordering. Call `Papa.unparse({ fields, data })` to obtain the CSV string.

Create a `Blob` from the CSV string with type `"text/csv;charset=utf-8;"`. Create an object URL from the blob using `URL.createObjectURL`. Create an anchor element, set its `href` to the object URL and its `download` attribute to `filename + ".csv"`. Programmatically call `anchor.click()`, then revoke the object URL via `URL.revokeObjectURL` to release memory.

**Step 4: Implement exportToExcel**

Define an async function `exportToExcel(rows: ReportRow[], columns: ReportColumn[], sheetName: string, filename: string): void`. Use the `xlsx` library (imported as `XLSX` from `"xlsx"`). Call `XLSX.utils.aoa_to_sheet` with a two-dimensional array where the first row is the column headers (from `column.header`) and subsequent rows are the data values in column order. Set column widths using `ws['!cols']` as an array of `{ wch: column.width ?? 20 }` objects.

Create a new workbook with `XLSX.utils.book_new()` and append the sheet using `XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)`. Call `XLSX.writeFile(workbook, filename + ".xlsx")` to trigger the download. Note that in a browser environment, `XLSX.writeFile` uses the Blob/anchor pattern internally.

**Step 5: Implement exportToPDF**

Define an async function `exportToPDF(reportTitle: string, dateRange: string, rows: ReportRow[], columns: ReportColumn[], filename: string): void`. This function uses `@react-pdf/renderer`.

Import `Document`, `Page`, `View`, `Text`, `StyleSheet`, and `pdf` from `"@react-pdf/renderer"`. Define a `PDFReport` React component (within the same file or a sibling file at `src/lib/reports/PDFTemplate.tsx`) that accepts `reportTitle`, `dateRange`, `rows`, and `columns` as props and renders:
- A header `View` containing the VelvetPOS logotype text ("VelvetPOS") in Playfair Display equivalent styling, the `reportTitle`, and the `dateRange`.
- A `View` styled as a table header row with one `Text` per column header, using a pearl-equivalent background (`#F1EDE6`).
- One `View` per data row, alternating between white and a very light linen (`#EBE3DB`) background. Each row contains one `Text` per column value.
- A footer `View` with the generation timestamp and "Confidential — VelvetPOS".

Back in `exportToPDF`, call `pdf(<PDFReport … />).toBlob()` — this returns a Promise resolving to a Blob. Once resolved, create an object URL, attach it to an anchor element, and trigger the download, then revoke the URL.

Because `pdf().toBlob()` is asynchronous, the calling UI should show a loading spinner while the PDF is being generated. The export function itself simply returns the Promise.

**Step 6: Handle column font styling in PDF**

PDF money columns (identified by checking if the column header contains "Revenue", "Value", "Amount", "Price", or "Commission") should use a monospace font equivalent in the PDF. Register the JetBrains Mono font with `Font.register` from `@react-pdf/renderer` pointing to the font file in `public/fonts/`. Apply the registered font family to those cells via the `StyleSheet`.

**Step 7: Wire utilities into ReportLayout**

In `src/components/reports/ReportLayout.tsx`, import the three export functions. The Export `DropdownMenuItem` for "Export as CSV" calls `exportToCSV(reportData, reportColumns, reportTitle)`. The PDF item calls `exportToPDF(reportTitle, formattedDateRange, reportData, reportColumns, reportTitle)`. The Excel item calls `exportToExcel(reportData, reportColumns, reportTitle, reportTitle)`.

The `reportColumns` prop is passed into `ReportLayout` by each individual report page — each page defines its own `columns: ReportColumn[]` array and passes it down. The `reportTitle` is also passed as a prop string. This keeps the layout component generic while allowing each page to control its own column structure.

**Step 8: Add export loading state**

In `ReportLayout`, add a `isExporting` React state boolean. Set it to `true` before calling any export function and back to `false` in a `finally` block. While `isExporting` is true, render a ShadCN `Spinner` inside the Export button and disable the dropdown from opening again. This prevents double-clicks from initiating two simultaneous downloads.

---

## Expected Output

- `src/lib/reports/export.ts` exports `exportToCSV`, `exportToExcel`, and `exportToPDF`.
- CSV export downloads a `filename.csv` file with correct headers and row data.
- Excel export downloads a `filename.xlsx` file with the correct sheet name and column widths.
- PDF export downloads a `filename.pdf` file with the VelvetPOS header, date range, table, and footer.
- The Export dropdown in `ReportLayout` shows a spinner while generating.

---

## Validation

- [ ] CSV export opens in Excel or any spreadsheet app with correct column headers in the first row.
- [ ] Excel export contains a named sheet matching the report title.
- [ ] PDF export renders column headers in the pearl background and alternating row shading.
- [ ] PDF footer shows the generation timestamp in the format "Generated: 17 Mar 2026, 09:30".
- [ ] Monetary columns in the PDF use the monospace font.
- [ ] Double-clicking Export does not trigger two simultaneous downloads.
- [ ] `URL.revokeObjectURL` is called after each download to prevent memory leaks.
- [ ] All three export functions work correctly in the browser (not Node.js — these are client-side utilities).

---

## Notes

- `exportToPDF` must only be called from client components (it uses browser APIs and React rendering). Import it with a dynamic `import()` inside client components if tree-shaking during SSR causes issues with `@react-pdf/renderer`.
- The `xlsx` library's `writeFile` function works in the browser via its built-in FileSaver fallback, but if issues arise, manually implement the Blob + anchor pattern instead of relying on `writeFile` directly.
