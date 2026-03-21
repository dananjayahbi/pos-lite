import { Suspense } from "react";
import RevenueTrendClient from "@/components/reports/RevenueTrendClient";

export default function RevenueTrendPage() {
  return (
    <Suspense>
      <RevenueTrendClient />
    </Suspense>
  );
}
