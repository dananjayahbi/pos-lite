import { Suspense } from "react";
import StaffPerformanceClient from "@/components/reports/StaffPerformanceClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function StaffPerformancePage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <StaffPerformanceClient />
      </ErrorBoundary>
    </Suspense>
  );
}
