"use client";

import { Button } from "@/components/ui/button";

export default function EmptySearchResults({
  searchQuery,
  onClearSearch,
}: {
  searchQuery: string;
  onClearSearch?: () => void;
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
            className="stroke-mist"
          >
            {/* Lens circle */}
            <circle cx="42" cy="42" r="20" strokeWidth="3" />
            {/* Handle */}
            <line
              x1="56"
              y1="56"
              x2="76"
              y2="76"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* X in lens - line 1 */}
            <line
              x1="35"
              y1="35"
              x2="49"
              y2="49"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* X in lens - line 2 */}
            <line
              x1="49"
              y1="35"
              x2="35"
              y2="49"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-espresso">
          No results found
        </h2>
        <p className="max-w-md text-sm text-mist">
          No matches for{" "}
          <span className="font-mono text-espresso">
            &ldquo;{searchQuery}&rdquo;
          </span>
          . Try a different search term or clear the filter.
        </p>
        {onClearSearch && (
          <Button variant="ghost" onClick={onClearSearch}>
            Clear Search
          </Button>
        )}
      </div>
    </div>
  );
}
