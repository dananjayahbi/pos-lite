import { Suspense } from "react";
import ZeroValueAuditClient from "@/components/reports/ZeroValueAuditClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ZeroValueSalesPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <ZeroValueAuditClient />
      </ErrorBoundary>
    </Suspense>
  );
}
