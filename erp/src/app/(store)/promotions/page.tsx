import { Lock } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { getEffectivePermissions } from '@/lib/constants/permissions';
import { resolvePromotionPageAccess } from '@/lib/services/promotionAccess.core';
import PromotionsPageClient from './PromotionsPageClient';

export const metadata = { title: 'Promotions | AyurPOS' };

/**
 * ARGUS #332 — the promotions page used to render for every authenticated
 * role even when `GET /api/store/promotions` returned 403. Gate the page on
 * the same permission the list/create/edit APIs require, and pass the
 * resulting capabilities to the client so unauthorized controls never render.
 */
export default async function PromotionsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const access = resolvePromotionPageAccess(
    getEffectivePermissions(session.user.role, session.user.permissions),
  );

  if (!access.canView) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand/30">
              <Lock className="h-6 w-6 text-mist-ink" />
            </div>
            <CardTitle className="font-display text-xl text-espresso">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-body text-sm text-mist-ink">
              You do not have permission to view promotions. Ask the store owner to grant
              the promotion create or edit permission.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PromotionsPageClient
      canCreate={access.canCreate}
      canEdit={access.canEdit}
      canDelete={access.canDelete}
      canManageCustomerPricing={access.canManageCustomerPricing}
    />
  );
}
