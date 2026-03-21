import { Suspense } from "react";
import StockMovementsClient from "@/components/reports/StockMovementsClient";

export default function StockMovementsPage() {
  return (
    <Suspense>
      <StockMovementsClient />
    </Suspense>
  );
}
