"use client";

import { Button } from "@/components/ui/button";

export default function EmptyProductList({
  onAddProduct,
}: {
  onAddProduct?: () => void;
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
            {/* Hook curve */}
            <path
              d="M48 12C48 12 56 12 56 20C56 28 48 28 48 28"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Vertical drop */}
            <line
              x1="48"
              y1="28"
              x2="48"
              y2="44"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Horizontal bar */}
            <line
              x1="24"
              y1="44"
              x2="72"
              y2="44"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Left shoulder slope */}
            <line
              x1="24"
              y1="44"
              x2="16"
              y2="80"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Right shoulder slope */}
            <line
              x1="72"
              y1="44"
              x2="80"
              y2="80"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-espresso">
          Your catalogue is empty
        </h2>
        <p className="max-w-md text-sm text-mist">
          Add your first product to begin building your inventory. Include
          variants for size and colour.
        </p>
        {onAddProduct && (
          <Button
            className="bg-terracotta text-pearl hover:bg-terracotta/90"
            onClick={onAddProduct}
          >
            Add Product
          </Button>
        )}
      </div>
    </div>
  );
}
