'use client';

import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import type { WebsiteConfigData } from '@/types/website.types';

interface WebsiteHeaderProps {
  config: WebsiteConfigData;
  tenantSlug: string;
}

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
  const siteName = config.siteName || 'Ayurveda';

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        {/* Top bar: hamburger (mobile) */}
        <div className="site-header-inner">
          {/* Mobile hamburger */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          {/* Logo */}
          <Link href={`/site/${tenantSlug}`} className="flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="site-logo" />
            ) : (
              <span
                className="text-xl font-semibold tracking-wider uppercase"
                style={{ fontFamily: 'var(--font-dm-serif), serif' }}
              >
                {siteName}
              </span>
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="site-nav hidden md:flex absolute left-1/2 -translate-x-1/2">
            {navItems.map((item, i) => (
              <Link key={i} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Desktop bottom nav bar (if items exist) */}
        {navItems.length > 0 && (
          <div className="hidden md:flex justify-center border-t border-black/5 py-2">
            <nav className="site-nav">
              {navItems.map((item, i) => (
                <Link key={i} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
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
                  href={item.href}
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
