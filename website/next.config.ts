import type { NextConfig } from 'next';

/**
 * Customer-facing website Next.js configuration.
 *
 * The storefront is a read-only consumer of the ERP backend:
 *  - ERP runs separately at NEXT_PUBLIC_API_BASE_URL (e.g. http://admin.ruhunuwedagedara.lk:3003).
 *  - This site runs at http://ruhunuwedagedara.lk:3002 (mapped via /etc/hosts).
 *  - In production both are served from the same VPS behind a reverse proxy.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow cross-origin requests in dev mode. The browser reaches us via the
  // /etc/hosts-mapped `ruhunuwedagedara.lk` hostname, so Next.js sees those
  // requests as coming from a non-default origin. The admin subdomain also
  // issues `/_next/*` requests (image optimization, link prefetches) when
  // its response embeds URLs that reference the storefront. Without these,
  // Next.js warns and may block requests in a future major version. See:
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: [
    'ruhunuwedagedara.lk',
    'admin.ruhunuwedagedara.lk',
    'localhost',
    '127.0.0.1',
    '192.168.1.92',
  ],
  images: {
    remotePatterns: [
      // Cloudflare R2 public bucket (the ERP uploads media here)
      {
        protocol: 'https',
        hostname: 'pub-cb9257401309450fbbba5c298fcf0acc.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      // Cloudinary (fallback storage)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      // Supabase Storage (fallback storage)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;