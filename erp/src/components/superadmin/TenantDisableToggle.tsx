'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface TenantDisableToggleProps {
  tenantId: string;
  isActive: boolean;
}

export default function TenantDisableToggle({
  tenantId,
  isActive,
}: TenantDisableToggleProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle(enable: boolean) {
    setLoading(true);
    try {
      const endpoint = enable ? 'reactivate' : 'suspend';
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/${endpoint}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Action failed');
      }

      toast.success(enable ? 'Business enabled successfully' : 'Business disabled successfully');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-mist">
      <CardHeader>
        <CardTitle className="font-display text-espresso">
          {isActive ? 'Business is currently enabled' : 'Business is currently disabled'}
        </CardTitle>
        <CardDescription>
          {isActive
            ? 'Disabling the business will immediately block all staff and users from accessing it.'
            : 'Re-enable the business to restore access to all staff and users.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isActive ? (
          <ConfirmDialog
            title="Disable Business"
            description="This will immediately disable the business. All users will lose access. Are you sure?"
            confirmLabel="Disable Business"
            variant="danger"
            onConfirm={() => toggle(false)}
          >
            <Button variant="destructive" disabled={loading}>
              {loading ? 'Working…' : 'Disable Business'}
            </Button>
          </ConfirmDialog>
        ) : (
          <Button
            className="bg-espresso text-pearl hover:bg-espresso/90"
            disabled={loading}
            onClick={() => toggle(true)}
          >
            {loading ? 'Working…' : 'Enable Business'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
