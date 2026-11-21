import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { resolveAttendancePageAccess } from '@/lib/attendance/attendancePageAccess.core';

/**
 * ARGUS #355: `/staff/timeclock` is an all-staff attendance surface and needs
 * the same `staff:attendance:view` gate as its API. Without this a cashier saw
 * the heading, filters and zeroed cards around a 403 error.
 */
export default async function StaffTimeclockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const access = resolveAttendancePageAccess({
    authenticated: Boolean(session?.user),
    canViewAttendance: hasPermission(session?.user, PERMISSIONS.STAFF.viewAttendance),
  });

  if (access.kind === 'redirect') redirect(access.href);

  return <>{children}</>;
}
