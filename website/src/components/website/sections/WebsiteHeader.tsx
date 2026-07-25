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
 * Sticky site header with mobile slide-out nav and scroll-aware shadow.
 */
export function WebsiteHeader({ config, tenantSlug }: WebsiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = config.navItems ?? [];
  const logoUrl = config.logoUrl;
  const siteName = config.siteName || tenantSlug;
  const homeHref = tenantHomePath(tenantSlug);

  /**
   * Resolve a CMS nav item href to a full tenant-scoped path.
   * For the default tenant, clean paths like /about /shop /contact are used as-is.
   * For other tenants the slug is prepended. External URLs pass through.
   */
  function resolveNavHref(href: string): string {
    if (!href || href === '#') return href;
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    // Already scoped (e.g. /ruhunuwedagedara/about)
    if (href.startsWith(`/${tenantSlug}`) || href.startsWith(`/${tenantSlug}/`)) return href;
    // Default tenant — use clean URL (no slug prefix)
    const defaultSlug = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG) || 'ruhunuwedagedara';
    if (tenantSlug === defaultSlug) return href;
    // Non-default tenant — prepend slug
    if (href.startsWith('/')) return `/${tenantSlug}${href}`;
    return href;
  }

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <div className="site-header-inner">
          {/* Mobile hamburger */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          {/* Logo + Desktop nav in a single row */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href={homeHref} className="flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="site-logo" />
              ) : (
                <span
                  className="text-xl font-semibold tracking-wider uppercase"
                  style={{ fontFamily: 'var(--site-heading-font), serif' }}
                >
                  {siteName}
                </span>
              )}
            </Link>

            {/* Desktop nav — inline with logo, not absolute */}
            {navItems.length > 0 && (
              <nav className="site-nav hidden md:flex">
                {navItems.map((item, i) => (
                  <Link key={i} href={resolveNavHref(item.href)}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Cart icon (right-aligned in header) */}
          <div className="ml-auto flex items-center pr-4">
            <CartIcon tenantSlug={tenantSlug} />
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-nav-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="mobile-nav-panel">
            <div className="flex justify-between items-center mb-6">
              <span className="font-semibold text-lg">{siteName}</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {navItems.map((item, i) => (
                <Link
                  key={i}
                  href={resolveNavHref(item.href)}
                  className="text-base uppercase tracking-wider border-b border-black/10 pb-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}