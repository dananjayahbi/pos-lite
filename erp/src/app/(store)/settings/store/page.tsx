import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import StoreProfileSettingsForm from '@/components/settings/StoreProfileSettingsForm';

export const metadata = { title: 'Store Profile | AyurPOS' };

/**
 * M07-02 (OBS-81) — tenant self-service for the store profile.
 *
 * The page used to be a bare redirect('/dashboard') stub that orphaned
 * StoreProfileSettingsForm (the live /api/settings/store PATCH route had no UI
 * reaching it). This mirrors the taxes settings page: auth + tenant check
 * first (a tenantless SUPER_ADMIN goes to /superadmin/dashboard via
 * denialRouteFor), then gate on the same permission the API enforces
 * (settings:store_profile), then load the tenant's current values as the
 * form's initial state. The superadmin tenant-settings surface remains the
 * system-owner view and is untouched.
 */
export default async function StoreProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageStoreProfile)) {
    redirect('/dashboard');
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
    select: { name: true, logoUrl: true, settings: true },
  });

  // The storefront has its own brand (WebsiteConfig). It is deliberately kept
  // separate from the ERP store profile used on receipts/invoices; surface the
  // difference and link to the website settings (ARGUS #487).
  const website = await prisma.websiteConfig.findUnique({
    where: { tenantId: session.user.tenantId },
    select: { siteName: true, logoUrl: true },
  });

  const settings =
    typeof tenant.settings === 'object' && tenant.settings !== null
      ? (tenant.settings as Record<string, unknown>)
      : {};

  const initialValues = {
    storeName: tenant.name,
    logoUrl: typeof tenant.logoUrl === 'string' ? tenant.logoUrl : '',
    address: typeof settings.address === 'string' ? settings.address : '',
    phoneNumber: typeof settings.phoneNumber === 'string' ? settings.phoneNumber : '',
    receiptFooter: typeof settings.receiptFooter === 'string' ? settings.receiptFooter : '',
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Store profile</h1>
        <p className="mt-1 text-sm text-sand-ink">
          Manage the store name, logo, address and receipt footer used across POS and customer touchpoints.
          Changes are recorded in the audit log.
        </p>
      </div>
      <StoreProfileSettingsForm initialValues={initialValues} />

      <div className="rounded-lg border border-sand bg-linen/60 p-4 text-sm text-sand-ink">
        <p className="font-medium text-espresso">Storefront brand is managed separately</p>
        <p className="mt-1">
          This profile supplies the name, logo and address on receipts, invoices and internal
          documents{website?.siteName ? ` (${website.siteName})` : ''}. The public storefront
          {website?.siteName ? ` shows "${website.siteName}"` : ' uses its own website settings'}
          {website?.logoUrl || tenant.logoUrl ? ' with its own logo' : ''}; editing this page does
          not change it.
        </p>
        <Link href="/settings/website" className="mt-2 inline-block underline hover:text-terracotta">
          Manage the website brand
        </Link>
      </div>
    </div>
  );
}
