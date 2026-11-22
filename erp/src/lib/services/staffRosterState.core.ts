/**
 * Staff roster UI state (ARGUS #462).
 *
 * The roster table used to render its header whenever the query was not
 * loading, so a 500/504 or any failed request looked exactly like "zero
 * staff". Error must win over every other state so a failure can never be
 * mistaken for an empty team.
 */
export type StaffRosterState = 'loading' | 'error' | 'empty' | 'ready';

export interface StaffRosterStateInput {
  isLoading: boolean;
  isError: boolean;
  rowCount: number;
}

export function resolveStaffRosterState(input: StaffRosterStateInput): StaffRosterState {
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  return input.rowCount > 0 ? 'ready' : 'empty';
}
