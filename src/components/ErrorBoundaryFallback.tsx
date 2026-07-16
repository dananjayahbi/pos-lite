"use client";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  errorId: string;
}

export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
  errorId,
}: ErrorBoundaryFallbackProps) {
  return (
    <div className="w-full min-h-50 rounded-xl bg-linen border border-terracotta flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        {/* Warning icon */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-terracotta"
          aria-hidden="true"
        >
          <path
            d="M24 4L2 44h44L24 4z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="none"
          />
          <line
            x1="24"
            y1="18"
            x2="24"
            y2="30"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="24" cy="36" r="1.5" fill="currentColor" />
        </svg>

        <h2 className="font-display text-xl text-espresso">
          Something went wrong
        </h2>

        <p className="text-sm text-mist">
          An unexpected error occurred in this section. The error has been
          automatically reported.
        </p>

        <p className="text-xs text-mist">
          Reference:{" "}
          <span className="font-mono text-espresso">{errorId}</span>
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-terracotta"
            onClick={resetErrorBoundary}
          >
            Retry
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
