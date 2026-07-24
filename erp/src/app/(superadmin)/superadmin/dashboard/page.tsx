import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { MetricCard } from "@/components/superadmin/MetricCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Store, Users, Package } from "lucide-react";
import Link from "next/link";

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-pearl border-sand h-24 animate-pulse rounded-xl border"
        />
      ))}
    </div>
  );
}

async function DashboardMetrics() {
  const [totalBusinesses, totalUsers, totalProducts] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, role: { not: "SUPER_ADMIN" } } }),
    prisma.product.count({ where: { deletedAt: null } }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Total Businesses"
        value={totalBusinesses}
        icon={<Store className="h-6 w-6" />}
      />
      <MetricCard
        label="Total Staff"
        value={totalUsers}
        icon={<Users className="h-6 w-6" />}
      />
      <MetricCard
        label="Total Products"
        value={totalProducts}
        icon={<Package className="h-6 w-6" />}
      />
    </div>
  );
}

async function BusinessOverview() {
  const businesses = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          products: { where: { deletedAt: null } },
          sales: true,
        },
      },
    },
  });

  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Business Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {businesses.length === 0 ? (
            <p className="text-mist text-sm">No businesses configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell>
                      <Link
                        href={`/superadmin/tenants/${business.id}`}
                        className="font-medium text-espresso hover:underline"
                      >
                        {business.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{business.slug}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        business.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {business.status}
                      </span>
                    </TableCell>
                    <TableCell>{business._count.users}</TableCell>
                    <TableCell>{business._count.products}</TableCell>
                    <TableCell>{business._count.sales}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <main className="p-8">
      <h1 className="font-display text-espresso mb-6 text-2xl font-bold">
        Dashboard
      </h1>

      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardMetrics />
      </Suspense>

      <Suspense>
        <BusinessOverview />
      </Suspense>
    </main>
  );
}
