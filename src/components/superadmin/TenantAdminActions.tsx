'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { TenantStatus } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface TenantAdminActionsProps {
  tenantId: string;
  currentStatus: TenantStatus;
}

export default function TenantAdminActions({ tenantId, currentStatus }: TenantAdminActionsProps) {
  const router = useRouter();

  async function callAction(endpoint: string, successMsg: string) {
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/${endpoint}`, {
      method: 'POST',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Action failed');
    }

    toast.success(successMsg);
    router.refresh();
  }

  const showSuspend = currentStatus === 'ACTIVE' || currentStatus === 'GRACE_PERIOD';
  const showReactivate = currentStatus === 'SUSPENDED' || currentStatus === 'CANCELLED';
  const showGrace = currentStatus === 'ACTIVE';

  return (
    <div className="flex flex-wrap gap-3">
      {showSuspend && (
        <ConfirmDialog
          title="Suspend Tenant"
          description="This will immediately suspend the tenant. All users will lose access. Are you sure?"
          confirmLabel="Suspend"
          variant="danger"
          onConfirm={() => callAction('suspend', 'Tenant suspended successfully')}
        >
          <Button variant="destructive">Suspend Tenant</Button>
        </ConfirmDialog>
      )}

      {showReactivate && (
        <Button
          className="bg-espresso text-pearl hover:bg-espresso/90"
          onClick={async () => {
            try {
              await callAction('reactivate', 'Tenant reactivated successfully');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Reactivation failed');
            }
          }}
        >
          Reactivate Tenant
        </Button>
      )}

      {showGrace && (
        <ConfirmDialog
          title="Trigger Grace Period"
          description="This will put the tenant into a 14-day grace period. After expiry the tenant will be suspended. Continue?"
          confirmLabel="Trigger Grace Period"
          variant="warning"
          onConfirm={() => callAction('grace-period', 'Grace period triggered successfully')}
        >
          <Button className="bg-amber-500 text-white hover:bg-amber-600">
            Trigger Grace Period
          </Button>
        </ConfirmDialog>
      )}

      <Button variant="outline" onClick={() => toast.info('Coming in Phase 5')}>
        Export Data
      </Button>

      <Button variant="ghost" onClick={() => toast.info('Coming soon')}>
        Audit Log
      </Button>
    </div>
  );
}
