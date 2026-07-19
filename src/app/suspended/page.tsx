import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { auth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';

export default async function SuspendedPage() {
  const session = await auth();

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
        <AlertTriangle size={56} className="text-red-700" />

        {/* Heading */}
        <h1 className="font-display text-2xl font-bold text-red-700 text-center">
          Account Suspended
        </h1>

        {/* Description */}
        <p className="text-center text-espresso/70">
          Access to your business has been suspended. Please contact the administrator to restore access.
        </p>

        {/* Contact support */}
        <Card className="w-full border-espresso/20 bg-pearl">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-espresso/60 mb-2">Contact Support</p>
            <a
              href={`mailto:${supportEmail}`}
              className="text-sm underline text-espresso hover:text-espresso/70 block"
            >
              {supportEmail}
            </a>
            <p className="text-sm text-espresso/60 mt-1">{supportPhone}</p>
          </CardContent>
        </Card>

        {/* Back to login */}
        <Link
          href="/login"
          className="text-sm text-espresso/50 hover:text-espresso transition-colors"
        >
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
