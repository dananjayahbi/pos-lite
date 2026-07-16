import { ChartSkeleton, TableSkeleton } from "@/components/skeletons";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <ChartSkeleton />
      <TableSkeleton />
    </div>
  );
}
