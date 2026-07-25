import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getSaleById } from '@/lib/services/sale.service';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRupee } from '@/lib/format';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(date: Date | string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' });
}

function SaleStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800 hover:bg-green-100',
    OPEN: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    VOIDED: 'bg-red-100 text-red-800 hover:bg-red-100',
    ON_HOLD: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  };
  return (
    <Badge className={variants[status] ?? 'bg-slate-100 text-slate-700 hover:bg-slate-100'}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');

  if (!hasPermission(session.user, PERMISSIONS.SALE.viewSale)) {
    redirect('/dashboard');
  }

  const { saleId } = await params;

  let sale: Awaited<ReturnType<typeof getSaleById>>;
  try {
    sale = await getSaleById(tenantId, saleId);
  } catch {
    notFound();
  }

  const subtotal = Number(sale.subtotal);
  const discountAmount = Number(sale.discountAmount);
  const taxAmount = Number(sale.taxAmount);
  const totalAmount = Number(sale.totalAmount);
  const changeGiven = sale.changeGiven != null ? Number(sale.changeGiven) : null;

  return (
    <div className="space-y-6 p-6">
      {/* Back link */}
      <Link
        href="/sales"
        className="inline-flex items-center gap-1.5 text-sm text-sand transition-colors hover:text-espresso"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sales
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Sale Detail</h1>
          <p className="mt-1 font-mono text-xs text-sand">{sale.id}</p>
        </div>
        <SaleStatusBadge status={sale.status} />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-mist bg-white px-4 py-3">
          <p className="text-xs text-sand">Cashier</p>
          <p className="mt-1 truncate text-sm font-medium text-espresso">{sale.cashier.email}</p>
        </div>
        <div className="rounded-xl border border-mist bg-white px-4 py-3">
          <p className="text-xs text-sand">Date</p>
          <p className="mt-1 text-sm font-medium text-espresso">{formatDateTime(sale.createdAt)}</p>
        </div>
        <div className="rounded-xl border border-mist bg-white px-4 py-3">
          <p className="text-xs text-sand">Shift</p>
          <p className="mt-1 font-mono text-xs text-espresso">{sale.shift.id.slice(-8).toUpperCase()}</p>
          <p className="text-xs text-sand capitalize">{sale.shift.status.toLowerCase()}</p>
        </div>
        {sale.authorizingManager && (
          <div className="rounded-xl border border-mist bg-white px-4 py-3">
            <p className="text-xs text-sand">Authorized by</p>
            <p className="mt-1 truncate text-sm font-medium text-espresso">
              {sale.authorizingManager.email}
            </p>
          </div>
        )}
      </div>

      {/* Line items */}
      <section className="overflow-hidden rounded-2xl border border-mist/60 bg-white shadow-sm">
        <div className="border-b border-mist px-5 py-3">
          <h2 className="text-sm font-semibold text-espresso">Items</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
              <TableHead className="text-right">Returned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <p className="font-medium text-espresso">{line.productNameSnapshot}</p>
                  <p className="text-xs text-sand">{line.variantDescriptionSnapshot}</p>
                </TableCell>
                <TableCell className="font-mono text-xs text-sand">{line.sku}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatRupee(Number(line.unitPrice))}
                </TableCell>
                <TableCell className="text-right text-sm">{line.quantity}</TableCell>
                <TableCell className="text-right text-sm">
                  {Number(line.discountPercent) > 0 ? `${Number(line.discountPercent)}%` : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium text-espresso">
                  {formatRupee(Number(line.lineTotalAfterDiscount))}
                </TableCell>
                <TableCell className="text-right text-sm text-sand">
                  {line.returnedQuantity > 0 ? (
                    <span className="text-terracotta">{line.returnedQuantity}</span>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Payments */}
      {sale.payments.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-mist/60 bg-white shadow-sm">
          <div className="border-b border-mist px-5 py-3">
            <h2 className="text-sm font-semibold text-espresso">Payments</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium text-espresso">
                    {payment.method.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium text-espresso">
                    {formatRupee(Number(payment.amount))}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-sand">
                    {payment.cardReferenceNumber ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Totals */}
      <div className="flex justify-end">
        <dl className="w-full max-w-xs divide-y divide-mist/40 rounded-2xl border border-mist bg-white text-sm shadow-sm">
          <div className="flex justify-between px-5 py-2.5">
            <dt className="text-sand">Subtotal</dt>
            <dd className="font-medium text-espresso">{formatRupee(subtotal)}</dd>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between px-5 py-2.5 text-terracotta">
              <dt>Discount</dt>
              <dd>−{formatRupee(discountAmount)}</dd>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between px-5 py-2.5">
              <dt className="text-sand">Tax</dt>
              <dd className="font-medium text-espresso">{formatRupee(taxAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between px-5 py-3">
            <dt className="text-base font-semibold text-espresso">Total</dt>
            <dd className="text-base font-bold text-espresso">{formatRupee(totalAmount)}</dd>
          </div>
          {changeGiven != null && changeGiven > 0 && (
            <div className="flex justify-between px-5 py-2.5">
              <dt className="text-sand">Change Given</dt>
              <dd className="font-medium text-espresso">{formatRupee(changeGiven)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
