import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
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
