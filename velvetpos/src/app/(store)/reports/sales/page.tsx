import { Suspense } from "react";
import SalesReportClient from "@/components/reports/SalesReportClient";

export default function SalesReportPage() {
  return (
    <Suspense>
      <SalesReportClient />
    </Suspense>
  );
}
