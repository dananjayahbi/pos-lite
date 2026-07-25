'use client';

/**
 * PageSkeleton — generic split-list loading state for pages with a
 * left list panel and a right detail panel (e.g. brands, categories).
 *
 * Renders a header + animated placeholders for the list rows and an
 * empty detail-panel skeleton on the right.
 */
interface PageSkeletonProps {
  /** Number of left-side row placeholders. Default 6. */
  rows?: number;
  /** Optional caption for the right panel. Default 'Select an item to see details'. */
  caption?: string;
}

export function PageSkeleton({ rows = 6, caption = 'Select an item to see details' }: PageSkeletonProps) {
  return (
    <div className="flex gap-6 p-6" aria-busy="true" aria-live="polite">
      {/* Left panel */}
      <div className="w-3/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-sand" />
            <div className="h-3 w-20 animate-pulse rounded bg-sand/70" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded-md bg-sand" />
        </div>

        <div className="rounded-lg border border-sand bg-pearl p-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded px-2 py-2"
            >
              <div className="h-8 w-8 animate-pulse rounded bg-sand/70" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-sand/70" />
              <div className="h-5 w-8 animate-pulse rounded-full bg-sand/70" />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-2/5">
        <div className="flex h-full min-h-75 flex-col rounded-lg border border-sand bg-linen">
          <div className="border-b border-sand bg-pearl p-4">
            <div className="h-5 w-1/2 animate-pulse rounded bg-sand" />
          </div>
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-mist">{caption}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
