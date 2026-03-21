import { Suspense } from "react";
import ReportLayout from "@/components/reports/ReportLayout";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <ReportLayout>{children}</ReportLayout>
    </Suspense>
  );
}
