'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

interface SignOutButtonProps {
  /** Visual style variant */
  variant?: 'text' | 'button';
  /** Optional className overrides */
  className?: string;
  /** Button label — defaults to "Log Out" */
  label?: string;
}

/**
 * Reusable sign-out button that always redirects to the **current origin**,
 * so it works correctly on any deployment (localhost, Vercel preview, custom domain).
 */
export function SignOutButton({
  variant = 'text',
  className,
  label = 'Log Out',
}: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    // Use window.location.origin so the redirect is always correct,
    // regardless of what AUTH_URL / NEXTAUTH_URL is set to server-side.
    await signOut({ callbackUrl: `${window.location.origin}/login` });
  };

  const defaultTextClass =
    'text-xs text-terracotta transition-colors hover:text-espresso';
  const defaultButtonClass =
    'mt-2 text-xs text-pearl/40 transition-colors hover:text-red-400';

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={className ?? (variant === 'button' ? defaultButtonClass : defaultTextClass)}
    >
      {loading ? 'Signing out…' : label}
    </button>
  );
}
