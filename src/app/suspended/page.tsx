import Link from 'next/link';
import { AlertTriangle, XCircle } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const reason = typeof params.reason === 'string' ? params.reason : undefined;
  const isCancelled = reason === 'cancelled';

  const session = await auth();
  const tenantId = session?.user?.tenantId;

  let invoice: {
    invoiceNumber: string;
    amount: { toString(): string };
    dueDate: Date;
  } | null = null;

  if (tenantId) {
    invoice = await prisma.invoice.findFirst({
      where: {
        tenantId,
        status: { in: ['PENDING', 'FAILED'] },
      },
      orderBy: { dueDate: 'desc' },
      select: {
        invoiceNumber: true,
        amount: true,
        dueDate: true,
      },
    });
  }

  const supportEmail =
    process.env.SUPPORT_EMAIL ?? 'support@velvetpos.com';
  const supportPhone =
    process.env.SUPPORT_PHONE ?? '+94 11 234 5678';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linen px-4">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-display text-xl font-bold text-espresso">
            VelvetPOS
          </span>
          <div className="w-12 h-px bg-espresso/20" />
        </div>

        {/* Alert icon */}
        {isCancelled ? (
          <XCircle size={56} className="text-red-700" />
        ) : (
          <AlertTriangle size={56} className="text-red-700" />
        )}

        {/* Heading */}
        <h1 className="font-display text-2xl font-bold text-red-700 text-center">
          {isCancelled
            ? 'Subscription Cancelled'
            : 'Subscription Suspended'}
        </h1>

        {/* Description */}
        <p className="text-center text-espresso/70">
          {isCancelled
            ? 'Your VelvetPOS subscription has been cancelled. Renew your subscription to regain access to your store.'
            : 'Access to your VelvetPOS store has been suspended due to an outstanding payment. Please settle your balance to restore access.'}
        </p>

        {/* Outstanding invoice card */}
        {invoice && (
          <Card className="w-full border-espresso/20 bg-pearl">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-espresso/60">Invoice</span>
                <span className="font-mono text-sm text-espresso">
                  {invoice.invoiceNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-espresso/60">Amount Due</span>
                <span className="font-mono text-sm font-semibold text-red-700">
                  LKR{' '}
                  {Number(invoice.amount).toLocaleString('en-LK', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-espresso/60">Due Date</span>
                <span className="text-sm text-espresso">
                  {new Date(invoice.dueDate).toLocaleDateString('en-LK', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Renew subscription */}
        <Button asChild className="w-full">
          <Link href="/billing">Renew Subscription</Link>
        </Button>

        {/* Contact support */}
        <p className="text-sm text-espresso/50 text-center">
          Need help? Contact{' '}
          <a
            href={`mailto:${supportEmail}`}
            className="underline text-espresso/70 hover:text-espresso"
          >
            {supportEmail}
          </a>{' '}
          or call {supportPhone}
        </p>
      </div>
    </div>
  );
}
