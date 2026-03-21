"use client";

interface ListSkeletonProps {
  items?: number;
}

export function ListSkeleton({ items = 6 }: ListSkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="animate-pulse space-y-3"
    >
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 pb-3 ${
            i < items - 1 ? "border-b border-linen" : ""
          }`}
        >
          <div className="h-10 w-10 shrink-0 rounded-full bg-sand/40" />
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-sand/40" />
            <div className="h-3 w-32 rounded bg-mist/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
