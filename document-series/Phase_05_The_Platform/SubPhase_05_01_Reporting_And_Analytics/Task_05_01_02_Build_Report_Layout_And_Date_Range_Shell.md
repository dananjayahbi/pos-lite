# Task 05.01.02 — Build Report Layout and Date Range Shell

## Metadata

| Field        | Value                                                        |
|--------------|--------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                              |
| Phase        | 05 — The Platform                                            |
| Complexity   | Moderate                                                     |
| Dependencies | 05.01.01 (SavedReport model and API), ShadCN Calendar/Popover installed |

---

## Objective

Create the shared `ReportLayout` client component and route layout file that wraps every report page with a consistent date-range picker, export controls, "Save Report" dialog, and navigation sidebar.

---

## Context

All twelve report pages share identical peripheral UI needs: a date range filter that drives data, an export mechanism to PDF/CSV/Excel, and the ability to bookmark the current filter configuration. Rather than duplicating this logic per page, a single `ReportLayout` component is placed in the route layout so every page beneath `/reports/` inherits these controls automatically. Date range state lives in URL search params rather than component state, making every filtered view bookmarkable and shareable.

---

## Instructions

**Step 1: Create the route layout file**

Create `src/app/(dashboard)/[tenantSlug]/reports/layout.tsx` as a Server Component. This file should import and render the `ReportLayout` client component, passing the `children` prop through. The Server Component reads the tenant slug from `params` and passes it to `ReportLayout` as well so the sidebar navigation links can be prefixed with the correct tenant path.

**Step 2: Build the ReportLayout client component**

Create `src/components/reports/ReportLayout.tsx` and mark it with `"use client"` at the top. The component receives `tenantSlug: string` and `children: React.ReactNode` as props. It uses the `useSearchParams` and `useRouter` hooks from `next/navigation` to read and write the `from` and `to` URL parameters.

**Step 3: Build the DateRangePicker component**

Create `src/components/reports/DateRangePicker.tsx` as a client component. It renders a ShadCN `Popover` with a trigger button displaying the selected range in the format "Jan 1, 2026 – Jan 31, 2026" using `date-fns/format`. The popover content shows seven preset buttons arranged in a column — Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, and Custom Range — followed by two inline ShadCN `Calendar` components for start and end date selection when "Custom Range" is active.

Each preset button calculates the from/to dates using `date-fns` helpers (`startOfDay`, `endOfDay`, `subDays`, `startOfMonth`, `endOfMonth`, `subMonths`). On selection, the component fires an `onRangeChange` callback with the new `{ from: string, to: string }` pair in `YYYY-MM-DD` format.

**Step 4: Integrate DateRangePicker into ReportLayout**

In `ReportLayout`, the `DateRangePicker` `onRangeChange` callback uses `router.push` to update the URL with the new `from` and `to` params while preserving all other existing search params. Default the range to "Last 30 Days" if neither param is present in the URL on first render.

**Step 5: Build the Export dropdown**

Inside `ReportLayout`, add an Export button using a ShadCN `DropdownMenu`. The dropdown has three items: "Export as PDF", "Export as CSV", and "Export as Excel". Each item calls the corresponding export function from `src/lib/reports/export.ts` (created in Task 05.01.11). The report data and column definitions are passed into `ReportLayout` via a `ReportContext` — `useReportContext()` is called inside the export handlers to access the current report's dataset at the time of export.

**Step 6: Build the Save Report dialog**

Add a "Save Report" button next to the Export dropdown. It opens a ShadCN `Dialog` containing a React Hook Form + Zod form with a single field: `name` (required, min 1, max 100 characters). On submit, the form calls `POST /api/reports/saved` with `{ name, reportType, filters }` where `reportType` is passed to `ReportLayout` as a prop from each page and `filters` is serialised from the current URL search params. On success, close the dialog and show a `toast` success message. On error, display the error in the form.

**Step 7: Build the navigation sidebar**

Add a left-side `nav` element inside `ReportLayout` listing all available report pages. Each nav item is a Next.js `Link` component. The list of items is: Profit & Loss, Sales by Product, Sales by Staff, Revenue Trend, Inventory Valuation, Stock Movements, Customer Analytics, Staff Performance, and Return Rate. The active link (matching the current pathname) receives the terracotta `#A48374` left-border highlight and espresso `#3A2D28` text weight. Display the list using Playfair Display for the "Reports" heading and Inter for the nav item labels.

**Step 8: Create the ReportContext provider**

Create `src/lib/reports/ReportContext.tsx` as a client component. Export a `ReportProvider` that wraps each report page and provides two values via context: `reportData` (the current tabular dataset as an array of plain objects) and `setReportData` (a setter the individual report page calls after fetching). Export a `useReportContext` hook that reads from this context. Wrap the `children` inside `ReportLayout` with `ReportProvider`.

**Step 9: Apply VelvetPOS brand styling**

The `ReportLayout` shell uses a pearl `#F1EDE6` background for the sidebar, linen `#EBE3DB` for the header strip containing the date picker, and white for the main content area. Button and dropdown components use the espresso and terracotta tokens via Tailwind CSS 4 and ShadCN theme variables.

---

## Expected Output

- `layout.tsx` renders `ReportLayout` around every page under `/reports/`.
- Date range picker popover opens with preset buttons and custom calendar working correctly.
- Selecting a preset updates the `?from` and `?to` URL params and all report pages re-fetch.
- Export dropdown renders three items; each will call the matching export function once `export.ts` exists.
- Save Report dialog posts to `/api/reports/saved` and shows success/error feedback.
- Navigation sidebar shows all report types; the active route is visually highlighted.
- `ReportContext` exposes `reportData` and `setReportData` to all child report pages.

---

## Validation

- [ ] Navigating to `/reports/profit-loss` shows the sidebar, date picker, Export button, and Save Report button.
- [ ] Clicking "Last 30 Days" preset updates the URL to `?from=YYYY-MM-DD&to=YYYY-MM-DD` correctly.
- [ ] Clicking "Custom Range" reveals two calendar pickers.
- [ ] Refreshing the page on a filtered URL preserves the selected date range in the picker display.
- [ ] Save Report form shows a validation error if `name` is submitted empty.
- [ ] Successfully saving a report calls POST and shows a toast.
- [ ] The active report nav item has the terracotta left-border highlight.
- [ ] On mobile viewport (< 768 px), the sidebar collapses to a dropdown/hamburger pattern.
