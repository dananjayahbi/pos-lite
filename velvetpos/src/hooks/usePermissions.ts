'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { PermissionKey } from '@/lib/constants/permissions';

export function usePermissions() {
  const { data: session, status } = useSession();

  const permissions = useMemo(() => {
    if (!session?.user?.permissions || !Array.isArray(session.user.permissions)) {
      return [] as string[];
    }

    return session.user.permissions.filter((value): value is string => typeof value === 'string');
  }, [session?.user?.permissions]);

  return {
    hasPermission: (permission: PermissionKey) => permissions.includes(permission),
    isLoading: status === 'loading',
  };
}

export type { PermissionKey };
