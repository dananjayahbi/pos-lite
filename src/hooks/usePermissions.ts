'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { getEffectivePermissions, type PermissionKey } from '@/lib/constants/permissions';

export function usePermissions() {
  const { data: session, status } = useSession();

  const permissions = useMemo(() => {
    return getEffectivePermissions(session?.user?.role, session?.user?.permissions);
  }, [session?.user?.permissions, session?.user?.role]);

  return {
    hasPermission: (permission: PermissionKey) => permissions.includes(permission),
    isLoading: status === 'loading',
  };
}

export type { PermissionKey };
