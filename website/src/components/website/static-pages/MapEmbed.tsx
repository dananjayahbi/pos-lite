'use client';

import React from 'react';

interface MapEmbedProps {
  embedUrl?: string;
  address?: string;
}

export function MapEmbed({ embedUrl, address }: MapEmbedProps) {
  if (!embedUrl && !address) return null;

  // If an embed URL is configured, use it directly
  if (embedUrl) {
    return (
      <section className="py-8">
        <div className="rounded-xl overflow-hidden shadow-md border border-black/5">
          <iframe
            src={embedUrl}
            width="100%"
            height="350"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Location map"
            className="block"
          />
        </div>
      </section>
    );
  }

  // Fallback: embed a Google Maps search for the address
  if (address) {
    const encoded = encodeURIComponent(address);
    const mapsUrl = `https://maps.google.com/maps?q=${encoded}&output=embed`;

    return (
      <section className="py-8">
        <div className="rounded-xl overflow-hidden shadow-md border border-black/5">
          <iframe
            src={mapsUrl}
            width="100%"
            height="350"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Location map"
            className="block"
          />
        </div>
      </section>
    );
  }

  return null;
}
