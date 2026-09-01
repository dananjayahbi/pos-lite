'use client';

import React from 'react';
import Link from 'next/link';

interface TenantErrorProps {
  title: string;
  message: string;
  /** Primary retry action, e.g. an error boundary's `reset`. */
  onRetry?: () => void | undefined;
  /** Optional error digest shown for support. */
  digest?: string | undefined;
  /** Tenant slug used to build the home link. */
  tenantSlug?: string | undefined;
}

/**
 * Reusable, styled "something went wrong" full-page state. Dark, centered,
 * with a serif headline, a message, an optional retry button and a home link.
 * Extracted so any error boundary can render a consistent recovery UI.
 */
export function TenantError({
  title,
  message,
  onRetry,
  digest,
  tenantSlug,
}: TenantErrorProps) {
  const homeHref = tenantSlug ? `/${tenantSlug}` : '/';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#051610] text-center">
      <h1
        className="text-3xl md:text-5xl mb-4 text-white"
        style={{ fontFamily: 'var(--font-serif), serif' }}
      >
        {title}
      </h1>
      <p className="text-base text-[#cbd5e1] mb-2 max-w-md">{message}</p>
      {digest && (
        <p className="text-xs text-[#94a3b8] mb-6">Error ID: {digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-block px-6 py-3 rounded-full border-2 border-[#97c93e] text-[#97c93e] uppercase text-xs tracking-wider hover:bg-[#97c93e] hover:text-[#051610] transition-colors"
          >
            Try Again
          </button>
        )}
        <Link
          href={homeHref}
          className="inline-block px-6 py-3 rounded-full border-2 border-transparent text-[#cbd5e1] uppercase text-xs tracking-wider hover:text-[#97c93e] hover:underline"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
