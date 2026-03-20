// Shell placeholder — the AppSidebar and main content area will be integrated
// in SubPhase 02.xx when the navigation components are built.
import { headers } from 'next/headers';
import StoreLayoutClient from '@/components/shared/StoreLayoutClient';
import GracePeriodBanner from '@/components/shared/GracePeriodBanner';

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const isGracePeriod = headersList.get('x-grace-period') === 'true';
  const graceEndsAt = headersList.get('x-grace-ends-at');

  return (
    <div className="min-h-screen flex flex-col bg-linen">
      <GracePeriodBanner visible={isGracePeriod} graceEndsAt={graceEndsAt} />
      <div className="flex flex-1">
        <StoreLayoutClient>{children}</StoreLayoutClient>
      </div>
    </div>
  );
}
