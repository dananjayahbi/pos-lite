import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TenantStatusBadge from '@/components/superadmin/TenantStatusBadge';
import TenantAdminActions from '@/components/superadmin/TenantAdminActions';
import BusinessSettingsForm from '@/components/superadmin/BusinessSettingsForm';

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          products: { where: { deletedAt: null } },
          sales: true,
        },
      },
    },
  });

  if (!tenant) {
    notFound();
  }

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;

  const settingsInitialValues = {
    storeName: tenant.name,
    logoUrl: tenant.logoUrl ?? '',
    address: typeof settings.address === 'string' ? settings.address : '',
    phoneNumber: typeof settings.phoneNumber === 'string' ? settings.phoneNumber : '',
    receiptFooter: typeof settings.receiptFooter === 'string' ? settings.receiptFooter : '',
    currency: typeof settings.currency === 'string' ? settings.currency : 'LKR',
    timezone: typeof settings.timezone === 'string' ? settings.timezone : 'Asia/Colombo',
    vatRate: typeof settings.vatRate === 'number' ? settings.vatRate : 0,
    ssclRate: typeof settings.ssclRate === 'number' ? settings.ssclRate : 0,
  };

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/superadmin/tenants"
        className="text-sm text-espresso/70 hover:text-espresso transition-colors"
      >
        ← Back to Businesses
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="font-display text-2xl font-bold text-espresso">{tenant.name}</h1>
        <TenantStatusBadge status={tenant.status} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Slug</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-espresso">{tenant.slug}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">{tenant._count.users}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">{tenant._count.products}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">{tenant._count.sales}</p>
          </CardContent>
        </Card>
      </div>

      {/* Business Settings */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-espresso">Business Settings</h2>
        <BusinessSettingsForm tenantId={tenant.id} initialValues={settingsInitialValues} />
      </div>

      {/* Admin Actions */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-espresso">Admin Actions</h2>
        <TenantAdminActions tenantId={tenant.id} currentStatus={tenant.status} />
      </div>
    </div>
  );
}
