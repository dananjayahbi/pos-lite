"use client";

export function CardGridSkeleton() {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="animate-pulse grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-linen p-5 space-y-4">
          <div className="h-8 w-8 rounded-md bg-sand/40" />
          <div className="h-8 w-24 rounded bg-sand/40" />
          <div className="h-3 w-32 rounded bg-mist/40" />
        </div>
      ))}
    </div>
  );
}
