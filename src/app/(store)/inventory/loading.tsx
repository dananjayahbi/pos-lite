import { TableSkeleton } from "@/components/skeletons";

export default function InventoryLoading() {
  return <TableSkeleton columns={6} rows={10} />;
}
