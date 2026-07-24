import { Poppins, DM_Serif_Display, Cormorant_Garamond, Jost } from 'next/font/google';
import type { Metadata } from 'next';
import { SITE } from '@/config/site';
import './globals.css';

/**
 * Root layout for the customer-facing storefront.
 *
 * The site is hosted on the bare domain (e.g. ruhunuwedagedara.lk)
 * and renders at /[tenantSlug]. The Admin lives on a separate subdomain.
 */

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
  display: 'swap',
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
  style: ['normal', 'italic'],
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
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
      className={`${poppins.variable} ${dmSerifDisplay.variable} ${cormorantGaramond.variable} ${jost.variable}`}
    >
      <body
        className="antialiased"
        style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}