import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { resolveShiftAccessForUser } from '@/lib/shifts/shift-access-request';

/**
 * ARGUS #111: `/staff/shifts` is the tenant-wide shift ledger (it lists every
 * cashier and exposes Z-reports). Cashiers keep their own shift flows in the
 * POS, so anyone who is not management is sent there.
 */
export default async function StaffShiftsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const scope = resolveShiftAccessForUser(session.user);
  if (scope.kind !== 'tenant') redirect('/pos');

  return <>{children}</>;
}
