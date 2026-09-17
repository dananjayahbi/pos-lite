'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { WebsiteConfigData } from '@/types/website.types';

interface AnnouncementBarProps {
  config: WebsiteConfigData;
}

/**
 * M29-03 (req 3.4) — site-wide announcement top-bar (ERP preview copy).
 *
 * Mirrors the customer-facing component in the `website/` app: rendered in
 * normal flow as the first child of the shell, publishing its measured height as
 * `--announcement-bar-height` (default `0px`, i.e. the pre-feature layout) so a
 * fixed header can offset itself.
 */
export function AnnouncementBar({ config }: AnnouncementBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  const text = config.announcementBar?.text?.trim() ?? '';
  const link = config.announcementBar?.link?.trim() ?? '';
  const shouldRender = Boolean(text) && config.announcementBar?.isActive === true;

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
        <Link href={link} className="inline-flex items-center gap-2 hover:underline underline-offset-2">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}