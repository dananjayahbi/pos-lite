import { Suspense } from "react";
import CustomerAnalyticsClient from "@/components/reports/CustomerAnalyticsClient";

export default function CustomerAnalyticsPage() {
  return (
    <Suspense>
      <CustomerAnalyticsClient />
    </Suspense>
  );
}
