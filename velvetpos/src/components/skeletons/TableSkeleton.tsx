"use client";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 5, rows = 8 }: TableSkeletonProps) {
  return (
    <div role="presentation" aria-hidden="true" className="animate-pulse">
      {/* Header */}
      <div className="flex gap-4 border-b border-mist pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-sand/40 ${i === 0 ? "w-32" : "w-20"}`}
          />
        ))}
      </div>

      {/* Body rows */}
      <div className="mt-2 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4"
            style={{ opacity: i % 2 === 0 ? 1 : 0.6 }}
          >
            {Array.from({ length: columns }).map((_, j) => (
              <div
                key={j}
                className={`h-3 rounded bg-sand/40 ${j === 0 ? "w-32" : "w-20"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
