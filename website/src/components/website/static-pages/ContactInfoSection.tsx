'use client';

import React from 'react';
import { ContactInfoCards } from './ContactInfoCards';
import { MapEmbed } from './MapEmbed';

interface ContactInfoSectionProps {
  title?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: string;
  mapEmbedUrl?: string;
}

/**
 * "Get in Touch" — two-column Contact layout (reference:
 * `#contact-info-section`). Left column is the stacked touchpoint cards,
 * right column is the dark-themed embedded Google Map. The whole section
 * is hidden when there is nothing to render.
 */
export function ContactInfoSection({
  title,
  address,
  phone,
  email,
  businessHours,
  mapEmbedUrl,
}: ContactInfoSectionProps) {
  const hasInfo = Boolean(address || phone || email || businessHours);
  const hasMap = Boolean(mapEmbedUrl || address);

  if (!hasInfo && !hasMap) return null;

  return (
    <section
      id="contact-info-section"
      className="relative w-full py-20 sm:py-28 lg:py-36 overflow-hidden bg-[#051610]"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <ContactInfoCards
              {...(title ? { title } : {})}
              {...(address ? { address } : {})}
              {...(phone ? { phone } : {})}
              {...(email ? { email } : {})}
              {...(businessHours ? { businessHours } : {})}
            />
          </div>

          <div className="lg:col-span-7">
            <MapEmbed
              {...(mapEmbedUrl ? { embedUrl: mapEmbedUrl } : {})}
              {...(address ? { address } : {})}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
