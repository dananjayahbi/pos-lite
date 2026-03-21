import { Suspense } from "react";
import StaffPerformanceClient from "@/components/reports/StaffPerformanceClient";

export default function StaffPerformancePage() {
  return (
    <Suspense>
      <StaffPerformanceClient />
    </Suspense>
  );
}
