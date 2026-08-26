'use client';

import { Badge } from '@/components/ui/badge';

/**
 * Compact failure-reason tag (doc 43). Rendered next to the status badge when
 * a delivery is FAILED (or otherwise carries a failure reason) so dispatch
 * staff can triage at a glance.
 */
export function FailureReasonTag({ reason }: { reason?: string | null | undefined }) {
  if (!reason) return null;
  return (
    <span className="mt-1 flex max-w-xs flex-wrap items-start gap-1">
      <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
        <span className="mr-1 font-medium">Failed:</span>
        <span className="font-normal text-red-600">{reason}</span>
      </Badge>
    </span>
  );
}
