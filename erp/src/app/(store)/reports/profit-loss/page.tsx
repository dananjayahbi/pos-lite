import { Suspense } from "react";
import ProfitLossClient from "@/components/reports/ProfitLossClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ProfitLossPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <ProfitLossClient />
      </ErrorBoundary>
    </Suspense>
  );
}
