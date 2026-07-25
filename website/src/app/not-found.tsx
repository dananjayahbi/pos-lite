import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#ece2d6] text-center">
      <h1
        className="text-4xl md:text-6xl mb-4"
        style={{ fontFamily: 'var(--font-dm-serif), serif' }}
      >
        Page not found
      </h1>
      <p className="text-base md:text-lg text-gray-700 mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href={tenantHomePath('ruhunuwedagedara')}
        className="inline-block px-8 py-3 border-2 border-black text-black uppercase text-xs tracking-wider hover:bg-black hover:text-white transition-colors"
      >
        Back to Home
      </Link>
    </main>
  );
}