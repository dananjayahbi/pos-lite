import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDefaultRouteForRole } from '@/lib/utils/default-route';
import { Card, CardContent } from '@/components/ui/card';
import { SuspendedSignOut } from './suspended-sign-out';

/**
 * M08-01 (BUG-35): tenant-aware /suspended screen.
 *
 * src/proxy.ts redirects suspended tenants' page navigations here; this page
 * now verifies the claim server-side instead of rendering blindly:
 *  - no session            → informational screen + link to /login;
 *  - tenant not suspended  → redirect to the caller's default workspace route;
 *  - tenant suspended      → tenant name, support info, and a sign-out control.
 * Policy mirrors the login gate in src/lib/auth.ts: SUSPENDED and CANCELLED
 * are blocked; GRACE_PERIOD and ACTIVE are not.
 */
export default async function SuspendedPage() {
  const session = await auth();

  if (!session?.user) {
    return <InformationalScreen />;
  }

  const tenantId = session.user.tenantId;

  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, status: true },
    });
    const blocked =
      tenant !== null &&
      (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED');
    if (!blocked) {
      // Not actually suspended (or the tenant row is gone) — send the user
      // back to their workspace rather than lying to them.
      redirect(getDefaultRouteForRole(session.user.role));
    }

    return <SuspendedScreen businessName={tenant.name} />;
  }

  // Tenantless session (e.g. SUPER_ADMIN) has nothing to suspend — bounce to
  // their default route.
  redirect(getDefaultRouteForRole(session.user.role));
}

const supportEmail = process.env.SUPPORT_EMAIL ?? 'support@ayurpos.com';
const supportPhone = process.env.SUPPORT_PHONE ?? '+94 11 234 5678';

function SuspendedScreen({ businessName }: { businessName: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linen px-4">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-display text-xl font-bold text-espresso">
            AyurPOS
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
          Access to <span className="font-semibold">{businessName}</span> has
          been suspended. Please contact support to restore access.
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

        {/* Sign out of the blocked session */}
        <SuspendedSignOut />
      </div>
    </div>
  );
}

function InformationalScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linen px-4">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-display text-xl font-bold text-espresso">
            AyurPOS
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
          Access to a business workspace can be suspended by the platform
          administrator. If you believe this applies to you, please contact
          support to restore access.
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
