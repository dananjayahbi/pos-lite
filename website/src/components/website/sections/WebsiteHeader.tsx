/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import type { WebsiteConfigData } from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';
import { CartIcon } from '@/components/website/cart/CartIcon';

interface WebsiteHeaderProps {
  config: WebsiteConfigData;
  tenantSlug: string;
}

/**
 * Two-row header:
 *   Top row: centered logo
 *   Bottom row: centered nav menu (SHOP / ABOUT / CONTACT) + cart icon right
 *   Mobile: hamburger menu with slide-out drawer
 */
export function WebsiteHeader({ config, tenantSlug }: WebsiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const logoUrl = config.logoUrl;
  const siteName = config.siteName || 'Store';
  const homeHref = tenantHomePath(tenantSlug);

  // Default nav items if none configured: SHOP, ABOUT, CONTACT
  const defaultNav = [
    { label: 'SHOP', href: '/shop' },
    { label: 'ABOUT', href: '/about' },
    { label: 'CONTACT', href: '/contact' },
  ];
  const navItems = (config.navItems && config.navItems.length > 0
    ? config.navItems
    : defaultNav) as { label: string; href: string }[];

  function resolveNavHref(href: string): string {
    if (!href || href === '#') return href;
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    if (href.startsWith(`/${tenantSlug}`) || href.startsWith(`/${tenantSlug}/`)) return href;
    const defaultSlug =
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG) ||
      'ruhunuwedagedara';
    if (tenantSlug === defaultSlug) return href;
    if (href.startsWith('/')) return `/${tenantSlug}${href}`;
    return href;
  }

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        {/* ── Top Row: Centered Logo ── */}
        <div className="header-top-row">
          <Link href={homeHref} className="header-logo-link">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="site-logo" />
            ) : (
              <span
                className="header-logo-text"
                style={{ fontFamily: 'var(--site-heading-font), serif' }}
              >
                {siteName}
              </span>
            )}
          </Link>
        </div>

        {/* ── Bottom Row: Nav + Cart ── */}
        <div className="header-bottom-row">
          {/* Mobile hamburger left */}
          <button
            className="header-hamburger md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Desktop nav — centered */}
          <nav className="header-nav hidden md:flex">
            {navItems.map((item, i) => (
              <Link key={i} href={resolveNavHref(item.href)} className="nav-link">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Cart icon — right aligned */}
          <div className="header-cart-icon">
            <CartIcon tenantSlug={tenantSlug} />
          </div>
        </div>
      </header>

      {/* ── Mobile slide-out menu ── */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="mobile-menu-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="mobile-menu-close"
              >
                <X size={22} />
              </button>
            </div>
            <nav className="mobile-nav">
              {navItems.map((item, i) => (
                <Link
                  key={i}
                  href={resolveNavHref(item.href)}
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      <style jsx>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: #fff;
          border-bottom: 1px solid #eee;
          transition: box-shadow 0.3s ease;
        }
        .site-header.scrolled {
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }
        .header-top-row {
          display: flex;
          justify-content: center;
          padding: 16px 20px 8px;
        }
        .header-logo-link {
          display: flex;
          align-items: center;
        }
        .site-logo {
          max-height: 50px;
          width: auto;
          object-fit: contain;
        }
        .header-logo-text {
          font-size: 1.5rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #333;
        }
        .header-bottom-row {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 20px 12px;
          position: relative;
          min-height: 44px;
        }
        .header-nav {
          gap: 32px;
        }
        .nav-link {
          position: relative;
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #444;
          text-decoration: none;
          padding: 6px 0;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: var(--site-accent, #b08d6d);
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--site-accent, #b08d6d);
          transition: width 0.3s ease;
        }
        .nav-link:hover::after {
          width: 100%;
        }
        .header-cart-icon {
          position: absolute;
          right: 20px;
          display: flex;
          align-items: center;
        }
        .header-hamburger {
          position: absolute;
          left: 20px;
          display: flex;
          align-items: center;
          background: none;
          border: none;
          cursor: pointer;
          color: #444;
        }

        /* Mobile menu overlay */
        .mobile-menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(0, 0, 0, 0.4);
        }
        .mobile-menu-panel {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          max-width: 80vw;
          background: #fff;
          z-index: 101;
          padding: 24px 20px;
          box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
        }
        .mobile-menu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        .mobile-menu-title {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #444;
        }
        .mobile-menu-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
        }
        .mobile-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobile-nav-link {
          display: block;
          padding: 12px 0;
          font-size: 0.875rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #333;
          text-decoration: none;
          border-bottom: 1px solid #f0f0f0;
          transition: color 0.2s;
        }
        .mobile-nav-link:hover {
          color: var(--site-accent, #b08d6d);
        }

        @media (min-width: 768px) {
          .header-hamburger {
            display: none;
          }
        }
      `}</style>
    </>
  );
}