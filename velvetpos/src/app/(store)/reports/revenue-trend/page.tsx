import { Suspense } from "react";
import RevenueTrendClient from "@/components/reports/RevenueTrendClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RevenueTrendPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <RevenueTrendClient />
      </ErrorBoundary>
    </Suspense>
  );
}
