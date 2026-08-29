import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#051610] text-center">
      <h1
        className="text-4xl md:text-6xl mb-4 text-white"
        style={{ fontFamily: 'var(--font-serif), serif' }}
      >
        Page not found
      </h1>
      <p className="text-base md:text-lg text-[#cbd5e1] mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href={tenantHomePath('ruhunuwedagedara')}
        className="inline-block px-8 py-3 rounded-full border-2 border-[#97c93e] text-[#97c93e] uppercase text-xs tracking-wider hover:bg-[#97c93e] hover:text-[#051610] transition-colors"
      >
        Back to Home
      </Link>
    </main>
  );
}