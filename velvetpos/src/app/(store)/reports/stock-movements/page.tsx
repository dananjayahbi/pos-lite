import { Suspense } from "react";
import StockMovementsClient from "@/components/reports/StockMovementsClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function StockMovementsPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <StockMovementsClient />
      </ErrorBoundary>
    </Suspense>
  );
}
