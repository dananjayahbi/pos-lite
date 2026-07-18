import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { TenantStatus } from '@/generated/prisma/client';
import TenantFilters from '@/components/superadmin/TenantFilters';
import TenantStatusBadge from '@/components/superadmin/TenantStatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const search = typeof params.search === 'string' ? params.search : '';
  const status = typeof params.status === 'string' ? params.status : '';

  const where = {
    deletedAt: null,
    ...(search && {
      name: { contains: search, mode: 'insensitive' as const },
    }),
    ...(status && { status: status as TenantStatus }),
  };

  const businesses = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-espresso">
          Businesses
        </h1>
        <span className="text-sm text-sand">
          {businesses.length} of 2 businesses configured
        </span>
      </div>

      {/* Filters */}
      <TenantFilters />

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
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
              <TableCell className="font-mono">{business.slug}</TableCell>
              <TableCell>
                <TenantStatusBadge status={business.status} />
              </TableCell>
              <TableCell>
                {new Date(business.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Link
                  href={`/superadmin/tenants/${business.id}`}
                  className="text-terracotta hover:underline"
                >
                  Manage
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {businesses.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sand">
                No businesses found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
