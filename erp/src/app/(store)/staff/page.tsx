import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { resolveStaffPageAccess } from '@/lib/staff/staffPageState.core';
import StaffPageClient from './StaffPageClient';

/**
 * ARGUS #344: `/staff` requires `staff:view` server-side. Management actions
 * inside the page additionally require `staff:manage`.
 */
export default async function StaffPage() {
  const session = await auth();
  const access = resolveStaffPageAccess({
    authenticated: Boolean(session?.user),
    canViewStaff: hasPermission(session?.user, PERMISSIONS.STAFF.viewStaff),
  });

  if (access.kind === 'redirect') redirect(access.href);

  return (
    <StaffPageClient
      canManage={hasPermission(session?.user, PERMISSIONS.STAFF.manageStaff)}
    />
  );
}
