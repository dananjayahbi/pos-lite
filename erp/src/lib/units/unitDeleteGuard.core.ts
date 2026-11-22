/**
 * Delete-guard decision for units (ARGUS #485).
 *
 * The service used to inline three checks (built-in, in use, last unit) in one
 * order. Extracting the decision makes the precedence explicit and testable and
 * keeps the API sentinels stable: BUILT_IN_UNIT (400), UNIT_IN_USE (409),
 * LAST_UNIT (409).
 */

export type UnitDeleteBlock = 'BUILT_IN_UNIT' | 'UNIT_IN_USE' | 'LAST_UNIT' | null;

export interface UnitDeleteGuardInput {
  isBuiltIn: boolean;
  /** Live (not soft-deleted) raw materials that reference the unit. */
  liveUsage: number;
  /** Other live units left after removing this one. */
  remainingLiveUnits: number;
}

/** Returns the sentinel that blocks deletion, or null when deletion is safe. */
export function unitDeleteBlock(input: UnitDeleteGuardInput): UnitDeleteBlock {
  if (input.isBuiltIn) return 'BUILT_IN_UNIT';
  if (input.liveUsage > 0) return 'UNIT_IN_USE';
  if (input.remainingLiveUnits <= 0) return 'LAST_UNIT';
  return null;
}
