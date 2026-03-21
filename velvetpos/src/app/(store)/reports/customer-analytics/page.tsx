import { Suspense } from "react";
import CustomerAnalyticsClient from "@/components/reports/CustomerAnalyticsClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function CustomerAnalyticsPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <CustomerAnalyticsClient />
      </ErrorBoundary>
    </Suspense>
  );
}
