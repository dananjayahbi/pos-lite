import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';
import SuperAdminNav from '@/components/superadmin/SuperAdminNav';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user?.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="flex h-full w-60 flex-shrink-0 flex-col justify-between bg-espresso">
        {/* Wordmark */}
        <div>
          <div className="px-6 py-6">
            <p className="font-display text-xl font-bold text-pearl">
              VelvetPOS
            </p>
          </div>
          <div className="mx-6 border-b border-mist/30" />

          {/* Navigation */}
          <SuperAdminNav />
        </div>

        {/* Footer */}
        <div className="border-t border-mist/30 px-4 py-4">
          <p className="truncate text-xs text-pearl/50">
            {session.user?.email}
          </p>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="mt-2 text-xs text-pearl/40 transition-colors hover:text-red-400"
            >
              Log Out
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-pearl p-6">
        {/* Mobile warning */}
        <div className="mb-4 rounded-md border border-yellow-600 bg-yellow-600/10 p-3 text-sm text-yellow-700 md:hidden">
          The VelvetPOS Super Admin portal is designed for desktop use. Please
          switch to a desktop or laptop computer.
        </div>

        {children}
      </main>
    </div>
  );
}
