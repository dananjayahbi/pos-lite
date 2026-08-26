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

export default async function SaleDetailPage({ params }: { params: Promise<{ saleId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');

  if (session.user.role !== 'OWNER' && session.user.role !== 'MANAGER') {
    redirect('/dashboard');
  }
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
        className="text-sand hover:text-espresso inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sales
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-espresso text-2xl font-bold">Sale Detail</h1>
          <p className="text-sand mt-1 font-mono text-xs">{sale.id}</p>
        </div>
        <SaleStatusBadge status={sale.status} />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="border-mist rounded-xl border bg-white px-4 py-3">
          <p className="text-sand text-xs">Cashier</p>
          <p className="text-espresso mt-1 truncate text-sm font-medium">{sale.cashier.email}</p>
        </div>
        <div className="border-mist rounded-xl border bg-white px-4 py-3">
          <p className="text-sand text-xs">Date</p>
          <p className="text-espresso mt-1 text-sm font-medium">{formatDateTime(sale.createdAt)}</p>
        </div>
        <div className="border-mist rounded-xl border bg-white px-4 py-3">
          <p className="text-sand text-xs">Shift</p>
          {sale.shift ? (
            <>
              <p className="text-espresso mt-1 font-mono text-xs">
                {sale.shift.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-sand text-xs capitalize">{sale.shift.status.toLowerCase()}</p>
            </>
          ) : (
            <p className="text-espresso mt-1 text-sm font-medium">Management sale</p>
          )}
        </div>
        {sale.authorizingManager && (
          <div className="border-mist rounded-xl border bg-white px-4 py-3">
            <p className="text-sand text-xs">Authorized by</p>
            <p className="text-espresso mt-1 truncate text-sm font-medium">
              {sale.authorizingManager.email}
            </p>
          </div>
        )}
      </div>

      {/* Line items */}
      <section className="border-mist/60 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-mist border-b px-5 py-3">
          <h2 className="text-espresso text-sm font-semibold">Items</h2>
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
                  <p className="text-espresso font-medium">{line.productNameSnapshot}</p>
                  <p className="text-sand text-xs">{line.variantDescriptionSnapshot}</p>
                </TableCell>
                <TableCell className="text-sand font-mono text-xs">{line.sku}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatRupee(Number(line.unitPrice))}
                </TableCell>
                <TableCell className="text-right text-sm">{line.quantity}</TableCell>
                <TableCell className="text-right text-sm">
                  {Number(line.discountPercent) > 0 ? `${Number(line.discountPercent)}%` : '—'}
                </TableCell>
                <TableCell className="text-espresso text-right font-mono text-sm font-medium">
                  {formatRupee(Number(line.lineTotalAfterDiscount))}
                </TableCell>
                <TableCell className="text-sand text-right text-sm">
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
        <section className="border-mist/60 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-mist border-b px-5 py-3">
            <h2 className="text-espresso text-sm font-semibold">Payments</h2>
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
                  <TableCell className="text-espresso font-medium">
                    {payment.method.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell className="text-espresso text-right font-mono text-sm font-medium">
                    {formatRupee(Number(payment.amount))}
                  </TableCell>
                  <TableCell className="text-sand font-mono text-xs">
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
        <dl className="divide-mist/40 border-mist w-full max-w-xs divide-y rounded-2xl border bg-white text-sm shadow-sm">
          <div className="flex justify-between px-5 py-2.5">
            <dt className="text-sand">Subtotal</dt>
            <dd className="text-espresso font-medium">{formatRupee(subtotal)}</dd>
          </div>
          {discountAmount > 0 && (
            <div className="text-terracotta flex justify-between px-5 py-2.5">
              <dt>Discount</dt>
              <dd>−{formatRupee(discountAmount)}</dd>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between px-5 py-2.5">
              <dt className="text-sand">Tax</dt>
              <dd className="text-espresso font-medium">{formatRupee(taxAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between px-5 py-3">
            <dt className="text-espresso text-base font-semibold">Total</dt>
            <dd className="text-espresso text-base font-bold">{formatRupee(totalAmount)}</dd>
          </div>
          {changeGiven != null && changeGiven > 0 && (
            <div className="flex justify-between px-5 py-2.5">
              <dt className="text-sand">Change Given</dt>
              <dd className="text-espresso font-medium">{formatRupee(changeGiven)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
