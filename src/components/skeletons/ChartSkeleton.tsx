"use client";

const barHeights = [128, 192, 96, 224, 160, 256, 176];

export function ChartSkeleton() {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="animate-pulse rounded-xl bg-linen p-6"
    >
      {/* Title */}
      <div className="mb-6 h-5 w-48 rounded bg-sand/40"></div>

      {/* Chart area */}
      <div className="relative h-80">
        {/* Y axis line */}
        <div className="absolute left-0 top-0 h-full w-px bg-mist"></div>
        {/* X axis line */}
        <div className="absolute bottom-0 left-0 h-px w-full bg-mist"></div>

        {/* Bars */}
        <div className="flex h-full items-end justify-around px-6 pb-px">
          {barHeights.map((h, i) => (
            <div
              key={i}
              className="w-8 rounded-t bg-sand/40"
              style={{ height: h }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}
