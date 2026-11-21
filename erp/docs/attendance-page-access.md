# Attendance page access

`/staff/timeclock` is the tenant-wide daily attendance surface. Its API already
required `staff:attendance:view`, but the page had no server gate (ARGUS #355):
a cashier saw the Attendance heading, date picker, zeroed summary cards and an
error card after the API returned 403.

## Server gate

`src/app/(store)/staff/timeclock/layout.tsx` runs `resolveAttendancePageAccess`
before rendering:

| Session | Result |
| ------- | ------ |
| No user | redirect `/login` |
| Signed in, no `staff:attendance:view` | redirect `/pos` |
| Signed in with `staff:attendance:view` | render the page |

`/pos` is the cashier's home and the same denial destination used by the shared
`requirePagePermission` guard. The navigation already hides the Attendance item
without the permission; this makes direct URL entry behave the same way.

## Header clock-in

The global clock-in widget stays available for self-service on normal store
pages so cashiers can still clock their own shifts. It is hidden on the
attendance route for a user without `staff:attendance:view`
(`shouldShowClockWidget(pathname, canViewAttendance)`), as defense in depth if
the redirect is bypassed.

## Verification

`src/lib/attendance/__tests__/attendancePageAccess.core.test.ts` covers the
login/POS redirects, attendance path matching, and clock-in visibility on
attendance versus other store pages.
