import { Suspense } from "react";
import InventoryValuationClient from "@/components/reports/InventoryValuationClient";

export default function InventoryValuationPage() {
  return (
    <Suspense>
      <InventoryValuationClient />
    </Suspense>
  );
}
