import localFont from 'next/font/local';

export const displayFont = localFont({
  src: [
    {
      path: '../../public/fonts/playfair-display-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-display',
});

export const bodyFont = localFont({
  src: [
    {
      path: '../../public/fonts/inter-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/inter-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/inter-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-body',
});

export const monoFont = localFont({
  src: [
    {
      path: '../../public/fonts/jetbrains-mono-400.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-mono',
});
