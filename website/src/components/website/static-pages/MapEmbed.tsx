'use client';

import React from 'react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface MapEmbedProps {
  embedUrl?: string;
  address?: string;
}

/**
 * Dark-themed Google Map for the Contact page (reference:
 * `#contact-info-section` right column). Uses the reference's framed,
 * grayscale-inverted filter style. Falls back to an address search embed
 * when no explicit embed URL is configured.
 */
export function MapEmbed({ embedUrl, address }: MapEmbedProps) {
  const frameRef = useRevealOnScroll<HTMLDivElement>();

  if (!embedUrl && !address) return null;

  const src = embedUrl
    ? embedUrl
    : `https://maps.google.com/maps?q=${encodeURIComponent(address ?? '')}&output=embed`;

  return (
    <div ref={frameRef} className="contact-map-frame">
      <iframe
        src={src}
        title="Location map"
        className="contact-map-iframe"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
