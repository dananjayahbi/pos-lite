/**
 * Display label for the actor of a stock movement.
 *
 * `StockMovement.actorId` is NULLABLE — a storefront checkout reservation, a
 * courier status sync or any other automated mutation has no acting user (see
 * the schema comment on `StockMovement`). Seven call sites display this value
 * and only some guarded it, so a single automated movement crashed the
 * dashboard card, the stock-control dashboard and the audit table.
 *
 * Keeping the fallback in one place means the next consumer cannot get it
 * wrong, and every surface shows the same wording.
 */

/** Shown when no user performed the movement. */
export const SYSTEM_ACTOR_LABEL = 'System';

/**
 * The actor's email, or `SYSTEM_ACTOR_LABEL` when the movement was automated.
 * Accepts `null`/`undefined` because Prisma returns `null` for the relation.
 */
export function stockActorLabel(
  actor: { email: string } | null | undefined,
): string {
  return actor?.email ?? SYSTEM_ACTOR_LABEL;
}
