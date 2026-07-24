'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { tenantHomePath } from '@/lib/tenant';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for a single tenant storefront. Shown when the ERP
 * API is unreachable or returns invalid data.
 */
export default function StorefrontError({ error, reset }: ErrorProps) {
  const params = useParams<{ tenantSlug: string }>();
  const slug = params?.tenantSlug ?? 'home';

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-[#ece2d6] text-center">
      <h1
        className="text-3xl md:text-5xl mb-4"
        style={{ fontFamily: 'var(--font-dm-serif), serif' }}
      >
        Something went wrong
      </h1>
      <p className="text-base text-gray-700 mb-2 max-w-md">
        We couldn&apos;t load this storefront right now. Please try again in a
        moment.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-500 mb-6">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-block px-6 py-3 border-2 border-black text-black uppercase text-xs tracking-wider hover:bg-black hover:text-white transition-colors"
        >
          Try Again
        </button>
        <Link
          href={tenantHomePath(slug)}
          className="inline-block px-6 py-3 border-2 border-transparent text-black uppercase text-xs tracking-wider hover:underline"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}