'use client';

import React from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

interface ContactInfoCardsProps {
  title?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: string;
}

/**
 * "Get in Touch" — stacked contact touchpoint cards (reference:
 * `#contact-info-section` left column). Each entry shows a green icon chip,
 * an uppercase green label and a white value (links when relevant).
 * Renders nothing when no contact info is configured.
 */
export function ContactInfoCards({
  title,
  address,
  phone,
  email,
  businessHours,
}: ContactInfoCardsProps) {
  const sectionRef = useRevealOnScroll<HTMLDivElement>();

  const cards = [
    {
      icon: MapPin,
      label: 'VISIT OUR SANCTUARY',
      value: address,
      href: address
        ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
        : undefined,
    },
    {
      icon: Phone,
      label: 'DIRECT PHONE LINE',
      value: phone,
      href: phone ? `tel:${phone}` : undefined,
    },
    {
      icon: Mail,
      label: 'ELECTRONIC CORRESPONDENCE',
      value: email,
      href: email ? `mailto:${email}` : undefined,
    },
    {
      icon: Clock,
      label: 'OPERATING HOURS',
      value: businessHours,
    },
  ].filter((c) => c.value);

  if (cards.length === 0) return null;

  return (
    <div ref={sectionRef}>
      {title && (
        <h2 className="contact-section-title">{title}</h2>
      )}

      <div className="flex flex-col gap-4">
        {cards.map((card) => (
          <div key={card.label} className="contact-touchpoint-card">
            <div className="contact-icon-wrap">
              <card.icon size={20} />
            </div>
            <div className="flex flex-col">
              <span className="contact-label">{card.label}</span>
              {card.href ? (
                <a
                  href={card.href}
                  {...(card.label === 'VISIT OUR SANCTUARY'
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="contact-val"
                >
                  {card.value}
                </a>
              ) : (
                <span className="contact-val whitespace-pre-line">
                  {card.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
