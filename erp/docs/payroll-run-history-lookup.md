# Payroll run lookup by month (ARGUS #392)

The Reports page used to request `/api/store/payroll/runs?limit=60` and then
search that list for the selected month. A run older than the latest 60
(slightly over five years) was therefore reported as "No payroll run exists"
and could not be downloaded, even though it was still stored.

Now:

- `GET /api/store/payroll/runs?month=YYYY-MM` validates the month (same
  `validatePayrollMonth` contract as the preview/generate routes) and returns a
  one-element array for that exact tenant/month, or an empty array.
- `getPayrollRunSummaryForMonth` performs the scoped `tenantId_periodMonth`
  lookup server-side.
- `/payroll/reports` queries by month instead of scanning a window, so any
  stored run is reachable from the picker.

The list endpoint without `month` still serves the latest runs for the Run
Payroll history card and keeps its 60-run cap.
