import { Cinzel, Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import type { Metadata } from 'next';
import { SITE } from '@/config/site';
import './globals.css';

/**
 * Root layout for the customer-facing storefront.
 *
 * The site is hosted on the bare domain (e.g. ruhunuwedagedara.lk)
 * and renders at /[tenantSlug]. The Admin lives on a separate subdomain.
 *
 * Design system (Wedagedara Ayurveda theme):
 *   - Cinzel        (serif)       → display / headings / CTA buttons
 *   - Plus Jakarta Sans (sans)    → body, labels, inputs, prices
 *   - Playfair Display (accent)   → italic editorial text
 *
 * Legacy variable names (--font-poppins / --font-dm-serif / --font-cormorant /
 * --font-jost) are aliased in globals.css so existing components keep working.
 */

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-cinzel',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: {
    default: 'Ruhunuwedagedara',
    template: '%s | Ruhunuwedagedara',
  },
  description: 'Premium Ayurveda products crafted with natural ingredients.',
  metadataBase: new URL(SITE.siteUrl),
  openGraph: {
    type: 'website',
    siteName: 'Ruhunuwedagedara',
    locale: 'en_LK',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${plusJakarta.variable} ${playfair.variable}`}
    >
      <head>
        {/* Font Awesome 6 (icon set used across the design) */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: 'var(--font-plus-jakarta), sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}