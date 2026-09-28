'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { WebsiteConfigData } from '@/types/website.types';

interface AnnouncementBarProps {
  config: WebsiteConfigData;
}

/**
 * M29-03 (req 3.4) — site-wide announcement top-bar.
 *
 * Rendered in NORMAL FLOW as the first child of the shell so it pushes the page
 * down instead of overlapping the hero. The storefront header is `fixed`, so it
 * reads `--announcement-bar-height` to sit directly under the bar.
 *
 * When the bar is inactive (or has no text) the component renders nothing AND
 * publishes `0px`, which is the variable's default — so a site with no
 * announcement lays out exactly as it did before this feature existed.
 */
export function AnnouncementBar({ config }: AnnouncementBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  const text = config.announcementBar?.text?.trim() ?? '';
  const link = config.announcementBar?.link?.trim() ?? '';
  const shouldRender = Boolean(text) && config.announcementBar?.isActive === true;

  // Publish the measured height so `fixed` elements can offset themselves.
  // The default (`0px`) is set unconditionally, so the "off" state needs no
  // work from this component at all.
  useEffect(() => {
    const root = document.documentElement;
    if (!shouldRender) {
      root.style.setProperty('--announcement-bar-height', '0px');
      return;
    }

    const publish = () => {
      const height = barRef.current?.getBoundingClientRect().height ?? 0;
      root.style.setProperty('--announcement-bar-height', `${Math.round(height)}px`);
    };
    publish();

    // The bar wraps on narrow screens, changing its height.
    window.addEventListener('resize', publish);
    return () => {
      window.removeEventListener('resize', publish);
      root.style.setProperty('--announcement-bar-height', '0px');
    };
  }, [shouldRender, text]);

  if (!shouldRender) return null;

  const content = (
    <span className="text-xs sm:text-sm font-medium tracking-wide text-center">
      {text}
    </span>
  );

  return (
    <div
      ref={barRef}
      id="announcement-bar"
      role="region"
      aria-label="Site announcement"
      className="relative z-50 w-full px-6 sm:px-10 lg:px-16 py-2.5 bg-[#97c93e] text-black flex items-center justify-center"
    >
      {link ? (
        <Link
          href={link}
          className="inline-flex items-center gap-2 hover:underline underline-offset-2"
        >
          {content}
          <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true" />
        </Link>
      ) : (
        content
      )}
    </div>
  );
}