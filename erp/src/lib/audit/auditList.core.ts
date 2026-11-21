/** Audit list load state (ARGUS #455). Error must win over the empty state. */
export type AuditListMode = 'loading' | 'error' | 'empty' | 'ready';

export function auditListMode(input: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}): AuditListMode {
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  return input.count === 0 ? 'empty' : 'ready';
}
