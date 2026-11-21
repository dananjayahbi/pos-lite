import type { UserRole } from '@/generated/prisma/client';
import { staffDisplayName } from '@/lib/utils/staff-name';

/**
 * ARGUS #95 — Return authorization helpers.
 *
 * `Return.authorizedById` is nullable: legacy/imported rows and returns
 * processed by a non-manager (someone explicitly granted `sale:refund`) have
 * no authorizer. Every surface that renders the relation must tolerate null.
 */
const RETURN_AUTHORIZER_ROLES: readonly UserRole[] = [
  'MANAGER',
  'OWNER',
  'SUPER_ADMIN',
];

/** True when the signed-in actor may be recorded as the return's authorizer. */
export function canAuthorizeReturn(role: UserRole | null | undefined): boolean {
  return role != null && RETURN_AUTHORIZER_ROLES.includes(role);
}

/**
 * Display label for a return's initiator/authorizer. Missing relations render
 * a neutral label instead of dereferencing null.
 */
export function returnStaffLabel(
  actor: { email?: string | null } | null | undefined,
): string {
  return actor?.email ? staffDisplayName(actor.email) : 'Not recorded';
}
