/**
 * ARGUS #262 — dispatch queue pagination math.
 *
 * The API returns page/limit/total; the UI needs a truthful "Showing X–Y of N"
 * and a clamped page count without silently hiding rows.
 */
export interface PaginationSummary {
  /** 1-based index of the first row on the page (0 when the page is empty). */
  start: number;
  /** 1-based index of the last row on the page (0 when the page is empty). */
  end: number;
  totalPages: number;
}

export function paginationSummary(
  page: number,
  limit: number,
  total: number,
): PaginationSummary {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safePage = Math.max(1, Math.floor(page));
  const safeTotal = Math.max(0, Math.floor(total));
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));

  if (safeTotal === 0) {
    return { start: 0, end: 0, totalPages };
  }

  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safeLimit + 1;
  const end = Math.min(currentPage * safeLimit, safeTotal);
  return { start, end, totalPages };
}
