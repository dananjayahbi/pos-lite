import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import TaxSettingsForm from '@/components/settings/TaxSettingsForm';
import { Card, CardContent } from '@/components/ui/card';
import { canManageTaxSettings } from '@/lib/settings/settingsAudit.core';
import {
  missingTaxIdentityFields,
  taxIdentityFieldStatus,
} from '@/lib/settings/taxIdentity.core';
import { readTaxSchedule, todayIso } from '@/lib/settings/taxSettingsChange.core';

export const metadata = { title: 'Tax Settings | AyurPOS' };

export default async function TaxSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  // ARGUS #468 — VAT/SSCL are owner-only. Managers (and anyone with a stale
  // per-user override) get an explicit message instead of an editable form.
  if (!canManageTaxSettings(session.user.role)) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Tax settings</h1>
        </div>
        <Card className="border-mist">
          <CardContent className="py-10 text-center text-sm text-sand-ink">
            Tax rates are owner-only. Ask the store owner to change VAT or SSCL.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageTax)) redirect('/dashboard');

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });

  const settings = typeof tenant.settings === 'object' && tenant.settings !== null
    ? (tenant.settings as Record<string, unknown>)
    : {};

  const initialValues = {
    vatRate: typeof settings.vatRate === 'number' ? settings.vatRate : 0,
    ssclRate: typeof settings.ssclRate === 'number' ? settings.ssclRate : 0,
  };

  // ARGUS #475: the form needs the version it loaded (optimistic lock) and the
  // active/pending schedule so it can warn before a future-dated change.
  const today = todayIso();
  const schedule = readTaxSchedule(settings, today);

  const identityFields = taxIdentityFieldStatus(settings);
  const missingIdentityFieldCount = missingTaxIdentityFields(settings).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Tax settings</h1>
        <p className="mt-1 text-sm text-sand-ink">
          Configure the store-wide rates that sales use when products are tagged with VAT or SSCL tax rules.
          Only the store owner can change these rates.
        </p>
      </div>
      <TaxSettingsForm
        initialValues={initialValues}
        version={schedule.version}
        currentEffectiveFrom={schedule.effectiveFrom}
        today={today}
        pending={schedule.pending}
      />

      <Card className="border-mist">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
          <div>
            <p className="font-medium text-espresso">Store name, contact and receipt footer</p>
            <p className="text-sand-ink">
              These tax rates are separate from the store profile printed on receipts.
            </p>
          </div>
          <Link
            href="/settings/store"
            className="underline hover:text-terracotta"
          >
            Open Store Profile
          </Link>
        </CardContent>
      </Card>

      <Card className="border-mist">
        <CardContent className="space-y-4 py-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-espresso">
              Tax and invoice identity
            </h2>
            <p className="mt-1 text-sm text-sand-ink">
              {missingIdentityFieldCount === 0
                ? 'All identity fields are present in the tenant settings.'
                : `${missingIdentityFieldCount} of ${identityFields.length} fields are not configured. The current settings schema has no storage for them, so they cannot be edited here yet.`}
            </p>
          </div>

          <dl className="divide-y divide-mist/60 rounded-lg border border-mist bg-white text-sm">
            {identityFields.map((field) => (
              <div
                key={field.key}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <dt className="text-sand-ink">{field.label}</dt>
                <dd
                  className={
                    field.configured
                      ? 'font-mono text-espresso'
                      : 'font-medium text-[#9B2226]'
                  }
                >
                  {field.value ?? 'Not configured'}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rounded-lg border border-mist bg-pearl/50 p-3 text-sm text-sand-ink">
            <p>
              <span className="font-medium text-espresso">Price basis:</span> exclusive.
              Product prices are entered before tax and the matching VAT or SSCL is
              added at checkout.
            </p>
            <p className="mt-2">
              Receipts print one aggregate Tax line. VAT and SSCL are not split on the
              receipt because the sale line stores the tax amount but not the rule or
              rate that produced it.
            </p>
            {missingIdentityFieldCount > 0 && (
              <p className="mt-2">
                Registration numbers and invoice numbering need a schema migration before
                they can be saved and printed. They are shown here so the gap is visible
                rather than silently omitted from tax invoices.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
