'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { postLogoutAudit } from '@/lib/auth/logout-audit';

/**
 * M08-01 (BUG-35): sign-out control for the (server-rendered) /suspended
 * screen. Mirrors src/components/auth/SignOutButton.tsx — audit the logout
 * while the cookie still exists, then clear the session and return to /login.
 */
export function SuspendedSignOut() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await postLogoutAudit();
    // window.location.origin keeps the redirect correct on any deployment.
    await signOut({ callbackUrl: `${window.location.origin}/login` });
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm text-espresso/50 transition-colors hover:text-espresso disabled:opacity-50"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
