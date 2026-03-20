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

const PAGE_SIZE = 20;

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const search = typeof params.search === 'string' ? params.search : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where = {
    deletedAt: null,
    ...(search && {
      name: { contains: search, mode: 'insensitive' as const },
    }),
    ...(status && { status: status as TenantStatus }),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        subscriptions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tenant.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-espresso">
          Tenants
        </h1>
        <Link
          href="/superadmin/tenants/new"
          className="rounded-md bg-espresso px-4 py-2 text-pearl"
        >
          New Tenant
        </Link>
      </div>

      {/* Filters */}
      <TenantFilters />

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Store Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell>
                <Link
                  href={`/superadmin/tenants/${tenant.id}`}
                  className="font-medium text-espresso hover:underline"
                >
                  {tenant.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono">{tenant.slug}</TableCell>
              <TableCell>
                {tenant.subscriptions[0]?.plan?.name ?? 'No Plan'}
              </TableCell>
              <TableCell>
                <TenantStatusBadge status={tenant.status} />
              </TableCell>
              <TableCell>
                {new Date(tenant.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Link
                  href={`/superadmin/tenants/${tenant.id}`}
                  className="text-terracotta hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {tenants.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sand">
                No tenants found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-sand">
        <span>
          Showing {from}–{to} of {total} tenants
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page - 1}`}
              className="rounded-md border px-3 py-1 text-espresso hover:bg-mist"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page + 1}`}
              className="rounded-md border px-3 py-1 text-espresso hover:bg-mist"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
