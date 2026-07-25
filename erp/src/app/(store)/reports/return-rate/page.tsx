import { Suspense } from "react";
import ReturnRateClient from "@/components/reports/ReturnRateClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ReturnRatePage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <ReturnRateClient />
      </ErrorBoundary>
    </Suspense>
  );
}
