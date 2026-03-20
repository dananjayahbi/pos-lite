import type { Metadata } from 'next';
import './globals.css';
import { displayFont, bodyFont, monoFont } from '@/lib/fonts';
import QueryProvider from '@/components/shared/QueryProvider';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'VelvetPOS',
  description: 'Point of Sale system for modern clothing retail',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased`}>
      <body>
        <QueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

