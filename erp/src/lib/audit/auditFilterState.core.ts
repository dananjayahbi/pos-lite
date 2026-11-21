/**
 * Audit filter state + URL serialization (ARGUS #457).
 *
 * Filters lived only in React state, so an investigation could not be
 * bookmarked or shared. The state is now derived from and written to the URL.
 */
export interface AuditLogFilterStateLike {
  entityType: string;
  action: string;
  startDate: string;
  endDate: string;
  userId: string;
  /** Free-text search across entity id, type, action, IP and user agent. */
  search: string;
}

export const DEFAULT_AUDIT_FILTERS: AuditLogFilterStateLike = {
  entityType: 'ALL',
  action: 'ALL',
  startDate: '',
  endDate: '',
  userId: '',
  search: '',
};

export const AUDIT_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_AUDIT_PAGE_SIZE = 50;
export const MAX_AUDIT_SEARCH_LENGTH = 200;

function param(params: URLSearchParams, key: string): string {
  return (params.get(key) ?? '').trim();
}

/** Read bookmarkable filters from a query string. */
export function auditFiltersFromParams(params: URLSearchParams): AuditLogFilterStateLike {
  return {
    entityType: param(params, 'entityType') || DEFAULT_AUDIT_FILTERS.entityType,
    action: param(params, 'action') || DEFAULT_AUDIT_FILTERS.action,
    startDate: param(params, 'startDate'),
    endDate: param(params, 'endDate'),
    userId: param(params, 'userId'),
    search: param(params, 'search').slice(0, MAX_AUDIT_SEARCH_LENGTH),
  };
}

/**
 * Serialize active filters (plus optional paging) without empty noise. The
 * result is suitable for both the browser URL and the API query string.
 */
export function auditFiltersToQuery(
  filters: AuditLogFilterStateLike,
  page?: number,
  pageSize?: number,
): string {
  const params = new URLSearchParams();
  if (filters.entityType !== 'ALL' && filters.entityType.trim() !== '') {
    params.set('entityType', filters.entityType.trim());
  }
  if (filters.action !== 'ALL' && filters.action.trim() !== '') {
    params.set('action', filters.action.trim());
  }
  if (filters.startDate.trim() !== '') params.set('startDate', filters.startDate.trim());
  if (filters.endDate.trim() !== '') params.set('endDate', filters.endDate.trim());
  if (filters.userId.trim() !== '') params.set('userId', filters.userId.trim());
  if (filters.search.trim() !== '') {
    params.set('search', filters.search.trim().slice(0, MAX_AUDIT_SEARCH_LENGTH));
  }
  if (page !== undefined) params.set('page', String(Math.max(1, Math.trunc(page))));
  if (pageSize !== undefined) params.set('pageSize', String(normalizeAuditPageSize(pageSize)));
  return params.toString();
}

/** Only the supported page sizes; unknown values fall back to the default. */
export function normalizeAuditPageSize(value: number): number {
  return (AUDIT_PAGE_SIZES as readonly number[]).includes(Math.trunc(value))
    ? Math.trunc(value)
    : DEFAULT_AUDIT_PAGE_SIZE;
}
