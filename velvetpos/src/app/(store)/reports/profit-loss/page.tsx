import { Suspense } from "react";
import ProfitLossClient from "@/components/reports/ProfitLossClient";

export default function ProfitLossPage() {
  return (
    <Suspense>
      <ProfitLossClient />
    </Suspense>
  );
}
