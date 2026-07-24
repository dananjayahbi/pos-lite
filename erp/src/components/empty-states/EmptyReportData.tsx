"use client";

import { Button } from "@/components/ui/button";

export default function EmptyReportData({
  onChangeDateRange,
}: {
  onChangeDateRange?: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-center rounded-xl bg-linen p-8">
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-48 w-48 items-center justify-center rounded-full bg-sand/30">
          <svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Bar 1 (short) */}
            <rect
              x="20"
              y="56"
              width="14"
              height="24"
              rx="3"
              className="fill-sand/50 stroke-espresso"
              strokeWidth="2.5"
            />
            {/* Bar 2 (medium) */}
            <rect
              x="41"
              y="40"
              width="14"
              height="40"
              rx="3"
              className="fill-sand/50 stroke-espresso"
              strokeWidth="2.5"
            />
            {/* Bar 3 (tall) */}
            <rect
              x="62"
              y="22"
              width="14"
              height="58"
              rx="3"
              className="fill-sand/50 stroke-espresso"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-espresso">
          No data for this period
        </h2>
        <p className="max-w-md text-sm text-mist">
          Try adjusting the date range or check back after more sales have been
          recorded.
        </p>
        {onChangeDateRange && (
          <Button
            className="bg-terracotta text-pearl hover:bg-terracotta/90"
            onClick={onChangeDateRange}
          >
            Adjust Date Range
          </Button>
        )}
      </div>
    </div>
  );
}
