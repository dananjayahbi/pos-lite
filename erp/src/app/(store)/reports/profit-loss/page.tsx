import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { denialRouteFor, requirePagePermission } from "@/lib/auth/page-guards";
import { PERMISSIONS } from "@/lib/constants/permissions";
import ProfitLossClient from "@/components/reports/ProfitLossClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default async function ProfitLossPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  requirePagePermission(session.user, PERMISSIONS.REPORT.viewProfitReport);

  return (
    <Suspense>
      <ErrorBoundary>
        <ProfitLossClient />
      </ErrorBoundary>
    </Suspense>
  );
}
