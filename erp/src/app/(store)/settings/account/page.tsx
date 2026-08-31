import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AccountSettingsClient from '@/components/settings/AccountSettingsClient';

export const metadata = { title: 'My Account | AyurPOS' };

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <h1 className="font-display text-2xl font-bold text-espresso">My Account</h1>
      <AccountSettingsClient />
    </div>
  );
}
