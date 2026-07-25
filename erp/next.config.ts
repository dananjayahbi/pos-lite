import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Allow cross-origin requests in dev mode. The admin UI is reached via the
  // /etc/hosts-mapped `admin.ruhunuwedagedara.lk` hostname, and the storefront
  // subdomain may issue `/_next/*` requests when its pages embed URLs that
  // reference the admin (image optimization, link prefetches). Without these,
  // Next.js warns and may block requests in a future major version. See:
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: [
    'admin.ruhunuwedagedara.lk',
    'ruhunuwedagedara.lk',
    'localhost',
    '127.0.0.1',
    '192.168.1.92',
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Cloudflare R2 public dev hostnames (`<bucket-id>.r2.dev`) are used by
      // the default `CLOUDFLARE_R2_PUBLIC_BASE_URL`. Add any custom CDN domain
      // here when one is configured.
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "ayurpos",
  project: process.env.SENTRY_PROJECT || "ayurpos",
  silent: process.env.NODE_ENV === "production",
  sourcemaps: { disable: true },
});
