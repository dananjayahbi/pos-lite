import { Suspense } from "react";
import InventoryValuationClient from "@/components/reports/InventoryValuationClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function InventoryValuationPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <InventoryValuationClient />
      </ErrorBoundary>
    </Suspense>
  );
}
