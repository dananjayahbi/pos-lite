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
          className="text-2xl font-medium mb-6 text-center text-[var(--site-primary,#0a0a0a)]"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg p-5 shadow-sm border border-black/5 hover:shadow-md transition-shadow duration-300 text-center"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--site-bg,#ece2d6)] mb-3">
              <card.icon size={18} className="text-[var(--site-accent,#b4946e)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--site-primary,#0a0a0a)] mb-1">
              {card.label}
            </h3>
            {card.href ? (
              <a
                href={card.href}
                target={card.label === 'Address' ? '_blank' : undefined}
                rel={card.label === 'Address' ? 'noopener noreferrer' : undefined}
                className="text-sm text-gray-500 hover:text-[var(--site-accent,#b4946e)] transition-colors"
              >
                {card.value}
              </a>
            ) : (
              <p className="text-sm text-gray-500 whitespace-pre-line">
                {card.value}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
