import { auth } from '@/lib/auth';
import { denialRouteFor, requirePagePermission } from '@/lib/auth/page-guards';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { redirect } from 'next/navigation';
import { BarcodePrintingClient } from '@/components/inventory/BarcodePrintingClient';

export const metadata = {
  title: 'Barcode Printing | AyurPOS',
};

export default async function BarcodePrintingPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  requirePagePermission(session.user, PERMISSIONS.PRODUCT.viewProduct);

  return <BarcodePrintingClient />;
}
