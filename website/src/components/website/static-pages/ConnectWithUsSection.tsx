'use client';

import React from 'react';
import { Phone } from 'lucide-react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface ConnectWithUsSectionProps {
  title?: string;
  /** Label for the phone CTA button (e.g. "Call Us"). */
  phoneLabel?: string;
  /** Phone number dialled when the button is tapped (e.g. "+94 11 234 5678"). */
  phoneNumber?: string;
  /** Social pill entries — rendered only when non-empty. */
  socialEntries?: { key: string; value: string }[];
}

/**
 * "Connect With Us" — closing CTA block for the About page.
 * Renders a prominent phone button (with a `tel:` link) plus any configured
 * social pills. The whole section is hidden when there is nothing to show.
 */
export function ConnectWithUsSection({
  title,
  phoneLabel,
  phoneNumber,
  socialEntries,
}: ConnectWithUsSectionProps) {
  const sectionRef = useRevealOnScroll<HTMLElement>();

  const cleanNumber = phoneNumber ? phoneNumber.trim() : '';
  const hasPhone = cleanNumber.length > 0;
  const hasSocial = Boolean(socialEntries && socialEntries.length > 0);

  if (!hasPhone && !hasSocial) return null;

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-16 sm:py-24 overflow-hidden border-t border-white/5 bg-[#051610]"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
        <h2
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-wide leading-tight"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          {title || 'Connect With Us'}
        </h2>
        <div className="w-16 h-[2px] bg-[#97c93e]/60 mx-auto mt-4" />

        <div className="flex flex-wrap justify-center items-center gap-4 mt-10">
          {hasPhone && (
            <a
              href={`tel:${cleanNumber}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#97c93e] px-7 py-3.5 text-base font-semibold text-[#051610] hover:bg-[#b2db58] transition-colors duration-300 shadow-lg shadow-[#97c93e]/20"
            >
              <Phone className="h-5 w-5" />
              {phoneLabel || 'Call Us'}
            </a>
          )}

          {socialEntries?.map((entry) => (
            <a
              key={entry.key}
              href={entry.value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/80 hover:border-[#97c93e] hover:text-white transition-all duration-300 capitalize bg-white/5 hover:bg-white/10"
            >
              {entry.key}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
