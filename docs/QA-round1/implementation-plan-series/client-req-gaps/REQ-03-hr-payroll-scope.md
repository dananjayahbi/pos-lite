# REQ-03 — Req 3.8(HR): HR & Payroll module (NIC/bank/salary, EPF 8/12%, ETF 3%, payslip PDF, bank sheet) — unbuilt; scope decision

**Severity:** P2 (client req, no implementation — Appendix B anti-hallucination item) · **Type:** client-requirement gap · **Depends on:** M03-08 (staff lifecycle) if it proceeds · **Refs:** `QA_ROADMAP.md` Appendix B, req 2.4 "HR & Payroll HIDDEN"

## Verified source state (2026-09-15)
- No `Employee`/`Payroll`/`Payslip`/EPF/ETF model or route exists anywhere (Appendix B, re-confirmed by the module scans). The nearest surfaces are `TimeClock`, `CommissionRecord`, `CommissionPayout` (Module 20) — attendance + commission only, **not** salary structure, NIC/bank details, EPF (employee 8% / employer 12%), ETF (3%), payslip PDF, or bank salary sheets.
- Req 2.4 lists "HR & Payroll strictly HIDDEN" for DISPATCH_STAFF/FACTORY_MANAGER — currently vacuously true (nothing to hide).

## Fix approach (this is a scoping/decision doc, not an implementation plan)
1. **Raise with the client as a scope/schedule item** (roadmap explicitly says "must be raised as a scope item rather than a QA failure"). Two questions: (a) is HR/Payroll in this engagement's price/scope at all? (b) if yes, is a first slice (employee master + salary structure + EPF/ETF auto-calc + payslip PDF) acceptable, or full (attendance→OT→gross/net→bank sheet→returns)?
2. **If approved, the data model** extends `User` (staff) rather than a parallel Employee table — link NIC/bank/salary-structure to the existing staff record (M03-08 already makes staff manageable); add `PayrollPeriod`, `Payslip`, `StatutoryDeduction` (EPF/ETF rates as tenant settings so the 8/12/3% are configurable, not hardcoded).
3. Payslip PDF reuses the report-generation path (M34-03 server export). Bank sheet + EPF/ETF returns = CSV/XLSX exports (same).
4. **If NOT approved now:** record req 3.8 as deferred in `QA_CLIENT_REQ.md` (out-of-scope), so QA stops flagging the "HIDDEN" bullets as unverifiable and req 2.4 Role 2/3 HR-hiding is documented as N/A.

## Acceptance / gate
- A client decision logged; either a follow-on implementation-plan-series for HR (new module range, e.g. M36+) or an explicit `[DEFERRED — out of scope]` annotation. No code until decided.
