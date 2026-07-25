import { Suspense } from "react";
import SalesReportClient from "@/components/reports/SalesReportClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function SalesReportPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <SalesReportClient />
      </ErrorBoundary>
    </Suspense>
  );
}
