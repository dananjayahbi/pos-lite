'use client';

import React from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

interface ContactInfoCardsProps {
  title?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: string;
}

export function ContactInfoCards({
  title,
  address,
  phone,
  email,
  businessHours,
}: ContactInfoCardsProps) {
  const hasAny = address || phone || email || businessHours;
  if (!hasAny) return null;

  const cards = [
    {
      icon: MapPin,
      label: 'Address',
      value: address,
      href: address
        ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
        : undefined,
    },
    {
      icon: Phone,
      label: 'Phone',
      value: phone,
      href: phone ? `tel:${phone}` : undefined,
    },
    {
      icon: Mail,
      label: 'Email',
      value: email,
      href: email ? `mailto:${email}` : undefined,
    },
    {
      icon: Clock,
      label: 'Business Hours',
      value: businessHours,
    },
  ].filter((c) => c.value);

  if (cards.length === 0) return null;

  return (
    <section className="py-8">
      {title && (
        <h2
          className="text-2xl font-medium mb-6 text-center text-white"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-[#082017]/70 p-5 border border-white/10 backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] text-center"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#051610] mb-3">
              <card.icon size={18} className="text-[#97c93e]" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              {card.label}
            </h3>
            {card.href ? (
              <a
                href={card.href}
                target={card.label === 'Address' ? '_blank' : undefined}
                rel={card.label === 'Address' ? 'noopener noreferrer' : undefined}
                className="text-sm text-[#94a3b8] hover:text-[#97c93e] transition-colors"
              >
                {card.value}
              </a>
            ) : (
              <p className="text-sm text-[#94a3b8] whitespace-pre-line">
                {card.value}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
