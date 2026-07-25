"use client";

import { Button } from "@/components/ui/button";

export default function EmptyCustomerList({
  onAddCustomer,
}: {
  onAddCustomer?: () => void;
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
            {/* Left person head */}
            <circle cx="36" cy="30" r="10" strokeWidth="3" />
            {/* Left person body */}
            <path
              d="M18 72C18 56 26 48 36 48C40 48 43 49 46 51"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Right person head */}
            <circle cx="58" cy="26" r="10" strokeWidth="3" />
            {/* Right person body */}
            <path
              d="M76 68C76 52 68 44 58 44C52 44 48 46 44 50"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-espresso">
          No customers yet
        </h2>
        <p className="max-w-md text-sm text-mist">
          Customer profiles are created automatically when a sale is completed,
          or you can add them manually.
        </p>
        {onAddCustomer && (
          <Button
            className="bg-terracotta text-pearl hover:bg-terracotta/90"
            onClick={onAddCustomer}
          >
            Add Customer
          </Button>
        )}
      </div>
    </div>
  );
}
