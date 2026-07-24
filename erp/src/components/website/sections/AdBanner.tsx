'use client';

import React from 'react';
import Link from 'next/link';
import type { WebsiteAdData } from '@/types/website.types';

interface AdBannerProps {
  ad: WebsiteAdData;
}

export function AdBanner({ ad }: AdBannerProps) {
  if (!ad.isActive) return null;

  const content = (
    <div className="relative w-full overflow-hidden">
      {ad.mediaType === 'video' ? (
        <video
          src={ad.mediaUrl}
          autoPlay
          muted
          loop
          playsInline
          className="w-full hidden md:block"
          style={{ maxHeight: '200px', objectFit: 'cover' }}
        />
      ) : (
        <>
          <img
            src={ad.mediaUrl}
            alt={ad.name}
            className="w-full hidden md:block object-cover"
            style={{ maxHeight: '200px' }}
            loading="lazy"
          />
          <img
            src={ad.mobileMediaUrl || ad.mediaUrl}
            alt={ad.name}
            className="w-full block md:hidden object-cover"
            style={{ maxHeight: '150px' }}
            loading="lazy"
          />
        </>
      )}
    </div>
  );

  if (ad.targetUrl) {
    return (
      <Link href={ad.targetUrl} className="block">
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}
