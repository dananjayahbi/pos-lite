"use client";

import { Leaf } from "lucide-react";
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
          <Leaf className="h-24 w-24 text-mist" strokeWidth={1.2} />
        </div>
        <h2 className="font-display text-[22px] font-semibold text-espresso">
          Your catalogue is empty
        </h2>
        <p className="max-w-md text-sm text-mist">
          Add your first product to begin building your inventory. Include
          variants for form (powder, capsule, oil…) and pack size.
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
