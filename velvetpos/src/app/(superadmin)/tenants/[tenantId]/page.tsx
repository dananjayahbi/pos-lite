import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import TenantStatusBadge from '@/components/superadmin/TenantStatusBadge';
import TenantAdminActions from '@/components/superadmin/TenantAdminActions';

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

const invoiceStatusStyles: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  UNPAID: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-red-100 text-red-800',
};

export default async function TenantDetailPage({ params }: PageProps) {
  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptions: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      },
      invoices: {
        orderBy: { billingDate: 'desc' },
        take: 10,
      },
    },
  });

  if (!tenant) {
    notFound();
  }

  const subscription = tenant.subscriptions[0] ?? null;
  const settings = (tenant.settings ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/superadmin/tenants"
        className="text-sm text-espresso/70 hover:text-espresso transition-colors"
      >
        ← Back to Tenants
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="font-display text-2xl font-bold text-espresso">{tenant.name}</h1>
        <TenantStatusBadge status={tenant.status} />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">
              {subscription?.plan.name ?? 'No active plan'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Billing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">
              {subscription?.status ?? '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Next Renewal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">
              {subscription?.nextBillingDate
                ? new Date(subscription.nextBillingDate).toLocaleDateString()
                : '—'}
            </p>
          </CardContent>
        </Card>

        {tenant.status === 'GRACE_PERIOD' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-espresso/60">Grace Period Expiry</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-terracotta">
                {tenant.graceEndsAt
                  ? new Date(tenant.graceEndsAt).toLocaleDateString()
                  : '—'}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Store Slug</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-espresso">{tenant.slug}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Custom Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">{tenant.customDomain ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-espresso/60">Created Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-espresso">
              {new Date(tenant.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-espresso">Invoices</h2>
        {tenant.invoices.length === 0 ? (
          <p className="text-sm text-espresso/60">No invoices found.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Billing Date</TableHead>
                  <TableHead>Amount (LKR)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.billingDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {Number(invoice.amount).toLocaleString('en-LK', {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge className={invoiceStatusStyles[invoice.status] ?? ''}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.pdfUrl ? (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-espresso underline hover:text-espresso/70"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-sm text-espresso/40">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Admin Actions */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-espresso">Admin Actions</h2>
        <TenantAdminActions tenantId={tenant.id} currentStatus={tenant.status} />
      </div>

      {/* Store Settings */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-espresso">Store Settings</h2>
        <Card>
          <CardContent className="pt-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {settings.currency !== undefined && (
                <div>
                  <dt className="text-sm text-espresso/60">Currency</dt>
                  <dd className="font-medium text-espresso">{String(settings.currency)}</dd>
                </div>
              )}
              {settings.timezone !== undefined && (
                <div>
                  <dt className="text-sm text-espresso/60">Timezone</dt>
                  <dd className="font-medium text-espresso">{String(settings.timezone)}</dd>
                </div>
              )}
              {settings.vatRate !== undefined && (
                <div>
                  <dt className="text-sm text-espresso/60">VAT Rate</dt>
                  <dd className="font-medium text-espresso">{String(settings.vatRate)}%</dd>
                </div>
              )}
              {settings.ssclRate !== undefined && (
                <div>
                  <dt className="text-sm text-espresso/60">SSCL Rate</dt>
                  <dd className="font-medium text-espresso">{String(settings.ssclRate)}%</dd>
                </div>
              )}
              {settings.receiptFooter !== undefined && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-espresso/60">Receipt Footer</dt>
                  <dd className="font-medium text-espresso">{String(settings.receiptFooter)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
