import { Suspense } from "react";
import SalesByStaffClient from "@/components/reports/SalesByStaffClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function SalesByStaffPage() {
  return (
    <Suspense>
      <ErrorBoundary>
        <SalesByStaffClient />
      </ErrorBoundary>
    </Suspense>
  );
}
