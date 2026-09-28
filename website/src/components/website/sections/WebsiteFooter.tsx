'use client';

import React from 'react';
import type { WebsiteConfigData } from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';
import { SectionAmbience } from '@/components/website/sections/SectionAmbience';

interface WebsiteFooterProps {
  config: Record<string, unknown>;
  websiteConfig: WebsiteConfigData;
  tenantSlug: string;
}

/**
 * Section 10 — 3-column ancestral footer (dark gradient).
 * Col 1: brand logo + heritage blurb + social icons
 * Col 2: "EXPLORE APOTHECARY" navigation
 * Col 3: "ABOUT US" + sanctuary hours card
 * Plus a bottom bar with copyright + back-to-top button.
 */
export function WebsiteFooter({ websiteConfig, tenantSlug }: WebsiteFooterProps) {
  const socialLinks = websiteConfig.socialLinks ?? {};
  const siteName = websiteConfig.siteName || 'WEDAGEDARA';
  const logoUrl = websiteConfig.logoUrl;
  const homeHref = tenantHomePath(tenantSlug);
  const year = new Date().getFullYear();

  const socialEntries = (
    [
      { key: 'instagram', icon: 'fa-brands fa-instagram', href: socialLinks.instagram },
      { key: 'facebook', icon: 'fa-brands fa-facebook-f', href: socialLinks.facebook },
      { key: 'whatsapp', icon: 'fa-brands fa-whatsapp', href: socialLinks.whatsapp },
      { key: 'youtube', icon: 'fa-brands fa-youtube', href: socialLinks.youtube },
    ] as const
  ).filter((s) => s.href);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer id="main-footer" className="relative w-full pt-20 pb-12 bg-gradient-to-b from-[#051610] via-[#030e0a] to-[#010705] overflow-hidden border-t border-white/10">
      <SectionAmbience
        leaves={[
          { icon: 'fa-solid fa-leaf', classes: 'top-10 right-10 text-6xl text-[#97c93e]', speed: 0.18 },
          { icon: 'fa-solid fa-seedling', classes: 'bottom-14 left-8 text-7xl text-emerald-400', speed: 0.25 },
        ]}
        glows={['top-0 left-1/4 w-96 h-96 bg-[#97c93e]/10', 'bottom-0 right-1/4 w-80 h-80 bg-emerald-500/10']}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="footer-grid reveal-on-scroll">
          {/* Col 1: brand */}
          <div className="flex flex-col">
            <a href={homeHref} className="footer-brand-logo group">
              <div className="w-10 h-10 rounded-xl bg-white p-1 border border-[#97c93e]/40 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform overflow-hidden flex-shrink-0">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={`${siteName} logo`} className="w-full h-full object-contain" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-[#051610] font-serif text-lg font-bold">
                    W
                  </span>
                )}
              </div>
              <span className="font-cinzel tracking-[0.12em] font-extrabold text-[1.375rem] text-white">
                {siteName}
              </span>
            </a>

            <p className="footer-brand-text">
              {websiteConfig.footerAbout ||
                'Rooted in ancestral Ola Leaf manuscripts and ethical Ceylon forest sanctuaries. We slow-decoct sacred botanicals to preserve the purest healing potency for cellular vitality and timeless wellness.'}
            </p>

            <div className="footer-social-wrap">
              {socialEntries.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-btn"
                  aria-label={s.key}
                >
                  <i className={s.icon} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: navigation */}
          <div className="flex flex-col">
            <h3 className="footer-col-title">Explore Apothecary</h3>
            <nav className="footer-nav-list">
              <a href={`${homeHref}#products-section`} className="footer-nav-link group">
                <i className="fa-solid fa-seedling text-[11px] text-[#97c93e]/60 group-hover:text-[#97c93e] transition-colors" />
                <span>Featured Elixirs &amp; Oils</span>
              </a>
              <a href={`${homeHref}#top-selling-section`} className="footer-nav-link group">
                <i className="fa-solid fa-seedling text-[11px] text-[#97c93e]/60 group-hover:text-[#97c93e] transition-colors" />
                <span>Top Selling Remedies</span>
              </a>
              <a href={`${homeHref}#categories-section`} className="footer-nav-link group">
                <i className="fa-solid fa-seedling text-[11px] text-[#97c93e]/60 group-hover:text-[#97c93e] transition-colors" />
                <span>Botanical Categories</span>
              </a>
              <a href={`${homeHref}#latest-products-section`} className="footer-nav-link group">
                <i className="fa-solid fa-seedling text-[11px] text-[#97c93e]/60 group-hover:text-[#97c93e] transition-colors" />
                <span>Fresh Herbal Arrivals</span>
              </a>
              <a href={`${homeHref}#store-reference-section`} className="footer-nav-link group">
                <i className="fa-solid fa-seedling text-[11px] text-[#97c93e]/60 group-hover:text-[#97c93e] transition-colors" />
                <span>Physical Sanctuary</span>
              </a>
            </nav>
          </div>

          {/* Col 3: about us */}
          <div className="flex flex-col">
            <h3 className="footer-col-title">About Us</h3>
            <p className="footer-about-text">
              {websiteConfig.footerAbout ||
                'Wedagedara represents a multi-generational lineage of Ceylon Ayurvedic masters and certified herbalists. We bridge 5,000-year-old botanical alchemy with modern purity standards, sourcing every root from pesticide-free indigenous soils.'}
            </p>

            <div className="footer-hours-card">
              <span className="footer-hours-label">Sanctuary Consultation Hours</span>
              <span className="footer-hours-val">Monday – Sunday: 8:00 AM – 7:00 PM</span>
              <span className="text-xs text-gray-400 mt-1 font-sans">
                {websiteConfig.contactAddress || '42 Horton Place, Colombo 07'}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom-bar reveal-on-scroll">
          <p className="footer-copy-text">
            &copy; {year} {siteName}. All Rights Reserved. Crafted with Ancestral Wisdom.
          </p>
          <button onClick={scrollTop} className="footer-back-top-btn" aria-label="Back to Top">
            <span>TOP</span>
            <i className="fa-solid fa-arrow-up text-xs" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 40px;
        }
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 48px;
          }
        }
        @media (min-width: 1024px) {
          .footer-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 56px;
          }
        }
        .footer-col-title {
          font-family: var(--font-serif);
          font-size: 1.0625rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 22px;
          position: relative;
          padding-bottom: 12px;
        }
        .footer-col-title::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 36px;
          height: 2px;
          background: #97c93e;
          border-radius: 9999px;
        }
        .footer-brand-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          transition: opacity 200ms ease;
        }
        .footer-brand-logo:hover {
          opacity: 0.9;
        }
        .footer-brand-text {
          font-size: 0.875rem;
          color: #94a3b8;
          font-weight: 300;
          line-height: 1.7;
          margin-top: 18px;
          font-family: var(--font-sans);
        }
        .footer-social-wrap {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }
        .footer-social-btn {
          width: 40px;
          height: 40px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          text-decoration: none;
          transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .footer-social-btn:hover {
          background: #97c93e;
          color: #051610;
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(151, 201, 62, 0.3);
        }
        .footer-nav-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .footer-nav-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #94a3b8;
          font-size: 0.875rem;
          text-decoration: none;
          transition: all 250ms ease;
        }
        @media (min-width: 640px) {
          .footer-nav-link {
            font-size: 0.9375rem;
          }
        }
        .footer-nav-link:hover {
          color: #97c93e;
          transform: translateX(6px);
        }
        .footer-about-text {
          font-size: 0.875rem;
          color: #94a3b8;
          font-weight: 300;
          line-height: 1.7;
          font-family: var(--font-sans);
        }
        .footer-hours-card {
          margin-top: 18px;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .footer-hours-label {
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #97c93e;
          font-family: var(--font-sans);
        }
        .footer-hours-val {
          font-size: 0.8125rem;
          color: #e2e8f0;
          font-family: var(--font-sans);
        }
        .footer-bottom-bar {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 28px;
          margin-top: 56px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          justify-content: space-between;
        }
        @media (min-width: 640px) {
          .footer-bottom-bar {
            flex-direction: row;
          }
        }
        .footer-copy-text {
          font-size: 0.8125rem;
          color: #64748b;
          font-family: var(--font-sans);
        }
        .footer-back-top-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 9999px;
          background: rgba(8, 32, 23, 0.8);
          border: 1px solid rgba(151, 201, 62, 0.3);
          color: #97c93e;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 300ms ease;
        }
        .footer-back-top-btn:hover {
          background: #97c93e;
          color: #051610;
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(151, 201, 62, 0.35);
        }
      `}</style>
    </footer>
  );
}
