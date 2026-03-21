import { Suspense } from "react";
import ReturnRateClient from "@/components/reports/ReturnRateClient";

export default function ReturnRatePage() {
  return (
    <Suspense>
      <ReturnRateClient />
    </Suspense>
  );
}
