import { Suspense } from "react";
import SalesByStaffClient from "@/components/reports/SalesByStaffClient";

export default function SalesByStaffPage() {
  return (
    <Suspense>
      <SalesByStaffClient />
    </Suspense>
  );
}
