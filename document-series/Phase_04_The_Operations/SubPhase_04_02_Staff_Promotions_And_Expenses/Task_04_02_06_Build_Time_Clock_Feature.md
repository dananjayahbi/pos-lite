# Task 04.02.06 — Build Time Clock Feature

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.06 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Medium |
| Estimated Effort | 3–4 hours |
| Depends On | 04.02.01 (TimeClock model), 04.02.02 (staff detail page shell) |
| Produces | Clock-in/out API routes, time clock widget, TimeClockHistory tab component |
| Owner Role | Full-Stack Developer |

---

## Objective

Allow all authenticated staff to clock in and out directly from the operations dashboard. Time clock records are stored as TimeClock entries and linked to the user's current clockedInAt field on the User model. Managers can view time clock history for all staff. The feature also replaces the placeholder TimeClockHistory tab on the staff detail page.

---

## Context

The User model's clockedInAt field added in task 04.02.01 serves as a real-time indicator of whether a user is currently clocked in. When clockedInAt is not null, the user is considered on shift. The TimeClock model stores the complete history of all clock-in and clock-out events, enabling Managers to calculate hours worked per period. The shiftId field on TimeClock is an optional link to a POS Shift — this integration is relevant when a cashier opens a Shift at the terminal and clocks in simultaneously.

---

## Instructions

### Step 1: Create the Clock-In API Route

Create src/app/api/timeclock/clock-in/route.ts with a POST handler. Authenticate the session. Extract the userId from the session. Before creating any record, check whether User.clockedInAt is already non-null for that user — if so, return a 409 response with the message "You are already clocked in since [clockedInAt timestamp]." Accept an optional shiftId in the request body (for terminal-linked clock-ins). Within a Prisma transaction, create a TimeClock record with clockedInAt set to now and clockedOutAt null, then update User.clockedInAt to the same timestamp. Return the created TimeClock record and the updated User.clockedInAt.

### Step 2: Create the Clock-Out API Route

Create src/app/api/timeclock/clock-out/route.ts with a POST handler. Authenticate the session. Extract the userId. Check that User.clockedInAt is not null — if null, return a 409 with "You are not currently clocked in." Find the most recent TimeClock record for this user where clockedOutAt is null — this is the open session. Accept an optional notes string in the request body. Within a Prisma transaction, update that TimeClock record's clockedOutAt to now and set notes if provided, then update User.clockedInAt to null. Return the closed TimeClock record including the duration in minutes calculated as the difference between clockedOutAt and clockedInAt.

### Step 3: Create the Time Clock History API Route

Create src/app/api/timeclock/route.ts with a GET handler. Accept userId (optional, defaults to the session user), page, and pageSize as query parameters. If userId is provided and differs from the session user, enforce that the session role is MANAGER or OWNER. Return paginated TimeClock records with computed duration in minutes for completed sessions and a null duration for open sessions.

### Step 4: Build the Time Clock Widget

Create src/app/dashboard/[tenantSlug]/components/TimeClockWidget.tsx as a client component. This widget is rendered in the main dashboard home layout so all staff can access it immediately after login. Display the current user's clock status: if clockedInAt is not null, show a green indicator badge labelled "Clocked In" and display the current session duration as a live counter (update every minute using setInterval). Show a "Clock Out" button styled in terracotta (#A48374). If clockedInAt is null, show a neutral indicator labelled "Not Clocked In" and a "Clock In" button styled in the espresso (#3A2D28) colour. Both buttons call the appropriate API endpoints using useMutation. On success, invalidate the session profile query to refresh the clockedInAt state.

### Step 5: Add Live Session Timer

Within TimeClockWidget.tsx, implement a useEffect that sets up an interval updating a local state variable secondsElapsed every 60 seconds while the user is clocked in. On clock-out, clear the interval. Display the elapsed time as "Xh Ym" formatted text beneath the "Clocked In" status badge. Ensure the interval is also cleared when the component unmounts to prevent memory leaks.

### Step 6: Build the TimeClockHistory Tab Component

Replace the placeholder at src/app/dashboard/[tenantSlug]/staff/[staffId]/components/TimeClockHistory.tsx. Render a ShadCN Card with heading "Time Clock History". Include a summary section showing Total Hours This Week and Total Hours This Month, computed in the API route as aggregated sums of minutesWorked converted to hours. Render a paginated table with columns: Date, Clock In, Clock Out, Duration (formatted as "Xh Ym"), Linked Shift (showing the shift ID as a link if present), Notes, and Status (showing "Open" in terracotta for sessions with a null clockedOutAt, or "Completed" in a muted colour). Allow Managers to view any staff member's history; restrict Cashiers and Stock Clerks to their own records only, enforcing this at the API layer.

### Step 7: Integrate Clock-In with POS Shift Opening

Open the Shift open API route from Phase 03. Add an optional autoClockIn parameter. When autoClockIn is true and the requesting user is currently clocked out, call the clock-in logic with the new shiftId after the Shift is created. This integration is additive and non-breaking — existing shift-open behaviour is unchanged when autoClockIn is not provided.

---

## Expected Output

- POST /api/timeclock/clock-in creates a TimeClock record and updates User.clockedInAt atomically
- POST /api/timeclock/clock-out closes the open record and clears User.clockedInAt atomically
- The TimeClockWidget displays the correct status and live timer on the dashboard home
- The TimeClockHistory tab replaces the placeholder with a paginated history table and summary totals
- Clock-in during Shift open works when autoClockIn is passed

---

## Validation

- Log in as a CASHIER and click "Clock In" — confirm User.clockedInAt is set and the widget switches to "Clocked In" state
- Click "Clock In" again while already clocked in — confirm the 409 response and an appropriate error toast
- Click "Clock Out" — confirm User.clockedInAt is cleared and the TimeClock record has a non-null clockedOutAt
- Open a new POS Shift with autoClockIn true — confirm a TimeClock record is created with the shiftId linked
- Log in as a MANAGER and view a CASHIER's TimeClockHistory tab — confirm all records are visible
- Log in as a CASHIER and attempt to view another user's time clock records — confirm 403 response

---

## Notes

- Duration calculations should always be performed in minutes as integers to avoid floating-point precision issues. Format the Xh Ym display in a shared utility function to keep consistency between the widget and the history table.
- If a clock-out record is never created (e.g., browser crash, power failure), the TimeClock record remains open. Managers should be able to manually close open sessions from the history table — add a "Close Session" button in the Actions column of the TimeClockHistory table for MANAGER and OWNER roles, opening a dialog that accepts a manual clockedOutAt and an optional note.
