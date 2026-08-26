'use client';

import React from 'react';
import Link from 'next/link';
import { Facebook, Instagram, Mail, MessageCircle } from 'lucide-react';
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
  whatsapp: MessageCircle,
};

/**
 * Dark-brown footer with up to 4 columns (Quick Links, Categories, Customer Service,
 * About + Social Icons) and a copyright bottom bar.
 */
export function WebsiteFooter({ websiteConfig }: WebsiteFooterProps) {
  const footerColumns = websiteConfig.footerColumns ?? [];
  const socialLinks = websiteConfig.socialLinks ?? {};
  const footerAbout = websiteConfig.footerAbout;
  const siteName = websiteConfig.siteName || 'Our Store';
  const year = new Date().getFullYear();

  // Build social entries with proper href formatting
  const socialEntries = Object.entries(socialLinks)
    .filter(([, value]) => value && typeof value === 'string' && value.length > 0)
    .map(([key, value]) => {
      let href = value as string;
      if (key === 'email' && !href.startsWith('mailto:')) {
        href = `mailto:${href}`;
      }
      if (key === 'whatsapp' && !href.startsWith('https://')) {
        href = `https://wa.me/${href.replace(/^\+/, '')}`;
      }
      return { key, href };
    });

  // Prefer configured columns; fall back to sensible defaults
  const columns = footerColumns.length > 0 ? footerColumns : getDefaultColumns();

  // Distribute columns: first 3 from config, 4th is always About
  const linkColumns = columns.slice(0, 3);

  return (
    <footer className="site-footer-wrapper">
      <div className="site-footer">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="footer-grid">
            {/* Link columns */}
            {linkColumns.map((col, i) => (
              <div key={i} className="footer-column">
                <h4 className="footer-column-title">{col.title}</h4>
                <ul className="footer-links">
                  {(col.links ?? []).map((link, j) => (
                    <li key={j}>
                      <Link href={link.href} className="footer-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* About column — always the 4th */}
            <div className="footer-column">
              <h4 className="footer-column-title">About</h4>
              {footerAbout ? (
                <p className="footer-about">{footerAbout}</p>
              ) : (
                <p className="footer-about">
                  {siteName} — premium products crafted with care and tradition.
                </p>
              )}

              {/* Social icons */}
              {socialEntries.length > 0 && (
                <div className="footer-social">
                  {socialEntries.map(({ key, href }) => {
                    const Icon = SOCIAL_ICONS[key];
                    if (!Icon) return null;
                    return (
                      <a
                        key={key}
                        href={href}
                        className="footer-social-icon"
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
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <p className="footer-copyright">
            Copyright {year} &copy; {siteName}. All rights reserved.
          </p>
        </div>
      </div>

      <style jsx>{`
        /* ── Footer wrapper ── */
        .site-footer-wrapper {
          font-family: 'Montserrat', sans-serif;
        }

        /* ── Main footer ── */
        .site-footer {
          background-color: #2b2520;
          padding: 56px 0 40px;
          color: #f5ede3;
        }

        /* ── Grid layout ── */
        .footer-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 36px;
        }

        @media (min-width: 640px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .footer-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        /* ── Column title ── */
        .footer-column-title {
          font-size: 13px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #b08d6d;
          font-weight: 600;
          margin-bottom: 16px;
        }

        /* ── Link list ── */
        .footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .footer-link {
          font-size: 13px;
          color: #c4b8a8;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .footer-link:hover {
          color: #f5ede3;
        }

        /* ── About text ── */
        .footer-about {
          font-size: 13px;
          line-height: 1.7;
          color: #c4b8a8;
          margin-bottom: 16px;
        }

        /* ── Social icons ── */
        .footer-social {
          display: flex;
          gap: 12px;
        }

        .footer-social-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid #5a4e44;
          color: #c4b8a8;
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .footer-social-icon:hover {
          border-color: #b08d6d;
          color: #b08d6d;
          background-color: rgba(176, 141, 109, 0.08);
        }

        /* ── Bottom bar ── */
        .footer-bottom {
          background-color: #1f1b17;
          padding: 18px 0;
          text-align: center;
        }

        .footer-copyright {
          font-size: 12px;
          color: #8a7e72;
          letter-spacing: 0.5px;
        }

        /* ── Mobile adjustments ── */
        @media (max-width: 639px) {
          .site-footer {
            padding: 40px 0 28px;
          }

          .footer-grid {
            gap: 28px;
          }
        }
      `}</style>
    </footer>
  );
}

/** Sensible default columns when no footerColumns are configured. */
function getDefaultColumns() {
  return [
    {
      title: 'Quick Links',
      links: [
        { label: 'Shop', href: '/shop' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      title: 'Categories',
      links: [
        { label: 'All Products', href: '/shop' },
      ],
    },
    {
      title: 'Customer Service',
      links: [
        { label: 'Track Order', href: '/track' },
        { label: 'Contact Us', href: '/contact' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Shipping Info', href: '/shipping' },
        { label: 'Returns Policy', href: '/returns' },
      ],
    },
  ];
}
