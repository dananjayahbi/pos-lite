'use client';

import React from 'react';
import Link from 'next/link';
import { Facebook, Instagram, Mail, Phone, MessageCircle } from 'lucide-react';
import type { WebsiteConfigData } from '@/types/website.types';

interface WebsiteFooterProps {
  config: Record<string, unknown>;
  websiteConfig: WebsiteConfigData;
  tenantSlug: string;
}

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  facebook: Facebook,
  instagram: Instagram,
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
};

export function WebsiteFooter({ websiteConfig }: WebsiteFooterProps) {
  const footerColumns = websiteConfig.footerColumns ?? [];
  const socialLinks = websiteConfig.socialLinks ?? {};
  const footerAbout = websiteConfig.footerAbout;
  const siteName = websiteConfig.siteName || 'Ayurveda';

  const socialEntries = Object.entries(socialLinks).filter(
    ([, value]) => value && typeof value === 'string' && value.length > 0
  );

  return (
    <footer className="site-footer">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Footer columns */}
          {footerColumns.slice(0, 2).map((col, i) => (
            <div key={i}>
              <h4 className="site-footer-title">{col.title}</h4>
              <ul className="space-y-2">
                {(col.links ?? []).map((link, j) => (
                  <li key={j}>
                    <Link href={link.href} className="text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* About column */}
          <div>
            <h4 className="site-footer-title">About Us</h4>
            {footerAbout ? (
              <p className="text-sm leading-relaxed mb-4">{footerAbout}</p>
            ) : (
              <p className="text-sm leading-relaxed mb-4">
                {siteName} offers premium Ayurveda products crafted with natural ingredients and ancient wisdom.
              </p>
            )}

            {/* Social icons */}
            {socialEntries.length > 0 && (
              <div className="flex gap-3">
                {socialEntries.map(([key, value]) => {
                  const Icon = SOCIAL_ICONS[key];
                  if (!Icon) return null;

                  let href = value as string;
                  if (key === 'email' && !href.startsWith('mailto:')) href = `mailto:${href}`;
                  if (key === 'phone' && !href.startsWith('tel:')) href = `tel:${href}`;
                  if (key === 'whatsapp' && !href.startsWith('https://')) href = `https://wa.me/${href}`;

                  return (
                    <a
                      key={key}
                      href={href}
                      className="social-icon"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={key}
                    >
                      <Icon size={16} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="site-footer-bottom">
        <div className="max-w-7xl mx-auto px-4">
          <p>Copyright {new Date().getFullYear()} &copy; {siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
