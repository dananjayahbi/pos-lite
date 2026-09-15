import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import StoreLayoutClient from '@/components/shared/StoreLayoutClient';
import { getEffectivePermissions } from '@/lib/constants/permissions';
import { getTenantBranding } from '@/lib/tenant-branding';

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const tenantId = session?.user?.tenantId;

  // M08-01 (BUG-35) defense-in-depth: src/proxy.ts is the primary suspension
  // gate (403/redirect per request); this direct read is the matcher-gap
  // safety net. Kept cheap — a single findUnique selecting only status.
  // Policy mirrors the login gate: SUSPENDED and CANCELLED block; GRACE_PERIOD
  // and ACTIVE pass.
  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (tenant && (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED')) {
      redirect('/suspended');
    }
  }

  const permissions = getEffectivePermissions(session.user.role, session.user.permissions);
  const branding = await getTenantBranding(tenantId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-linen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-espresso focus:px-4 focus:py-2 focus:text-pearl focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="flex min-h-0 flex-1">
        <StoreLayoutClient
          userEmail={session.user.email ?? 'signed-in-user@ayurpos.dev'}
          userRole={session.user.role}
          permissions={permissions}
          businessName={branding.name}
          businessLogoUrl={branding.logoUrl}
        >
          {children}
        </StoreLayoutClient>
      </div>
    </div>
  );
}
