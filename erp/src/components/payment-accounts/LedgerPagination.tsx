'use client';

import { Button } from '@/components/ui/button';

interface LedgerPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Shared Previous/Next footer used by both ledger tables. */
export function LedgerPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  disabled,
}: LedgerPaginationProps) {
  const lastPage = Math.max(1, totalPages);
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-body text-xs text-sand">
        {total === 0 ? 'No entries' : `Showing ${firstRow}–${lastRow} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled === true || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="border-mist font-body"
        >
          Previous
        </Button>
        <span className="font-body text-sm text-sand">
          Page {page} of {lastPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled === true || page >= lastPage}
          onClick={() => onPageChange(page + 1)}
          className="border-mist font-body"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
