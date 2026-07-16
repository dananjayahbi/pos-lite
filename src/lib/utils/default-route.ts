import type { UserRole } from '@/generated/prisma/client';

const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  SUPER_ADMIN: '/superadmin/dashboard',
  OWNER: '/dashboard',
  MANAGER: '/dashboard',
  CASHIER: '/pos',
  STOCK_CLERK: '/dashboard',
};

export function getDefaultRouteForRole(role: UserRole | null | undefined): string {
  if (!role) {
    return '/dashboard';
  }

  return ROLE_DEFAULT_ROUTES[role];
}