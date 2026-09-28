/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { WebsiteConfigData } from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';
import { buildHeaderNav, resolveNavHref, isNavActive } from '@/lib/navigation';
import { useHeaderScrollState } from '@/hooks/useHeaderScrollState';
import { CartIcon } from '@/components/website/cart/CartIcon';
import { HeaderNavLink } from './HeaderNavLink';

interface WebsiteHeaderProps {
  config: WebsiteConfigData;
  tenantSlug: string;
}

/**
 * Fixed dark-glass luxury header for the storefront.
 *
 * Structure (from the reference design):
 *   - left: logo mark (rounded white tile) + site name + "Ayurvedic Heritage"
 *   - center (desktop): HOME / ABOUT / SHOP / CONTACT + Appointments pill
 *   - right: cart toggle + mobile hamburger
 * Gets a frosted `.glass-nav` + shrink effect when scrolled past 40px.
 */
export function WebsiteHeader({ config, tenantSlug }: WebsiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // `announcementOffset` is the part of the announcement bar still on screen,
  // so the header tracks it down and takes over the top edge once it is gone.
  // `condensed` is the shrink + frosted-glass treatment.
  const { announcementOffset, condensed } = useHeaderScrollState();

  const logoUrl = config.logoUrl;
  const siteName = config.siteName || 'Wedagedara';
  const homeHref = tenantHomePath(tenantSlug);

  // Lock body scroll when the mobile drawer is open.
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Build nav from config via the shared helper.
  const { items: navItems, appointments } = buildHeaderNav(config, tenantSlug);

  const isActive = (href: string) => isNavActive(href, pathname, tenantSlug);

  return (
    <>
      <header
        id="main-header"
        style={{ top: announcementOffset }}
        className={`fixed left-0 right-0 z-40 transition-all duration-300 px-6 sm:px-10 lg:px-16 py-5 ${
          condensed ? 'glass-nav py-3.5 shadow-2xl' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand / logo */}
          <Link href={homeHref} className="flex items-center gap-3 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white p-1 border border-[#97c93e]/40 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform overflow-hidden flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={`${siteName} logo`} className="w-full h-full object-contain" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-[#051610] font-serif text-lg font-bold">
                  W
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-cinzel tracking-[0.22em] text-base md:text-lg font-bold text-white uppercase group-hover:text-[#b2db58] transition-colors">
                {siteName}
              </span>
              <span className="text-[9px] tracking-[0.28em] uppercase text-gray-400 -mt-1 font-sans">
                Ayurvedic Heritage
              </span>
            </div>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-9">
            {navItems.map((item, i) => (
              <HeaderNavLink
                key={i}
                href={resolveNavHref(item.href, tenantSlug)}
                label={item.label}
                active={isActive(item.href)}
              />
            ))}
            <Link
              href={resolveNavHref(appointments.href, tenantSlug)}
              className="text-sm font-semibold tracking-wider uppercase px-4 py-2 rounded-full border border-[#97c93e]/40 text-[#b2db58] hover:bg-[#97c93e] hover:text-black transition-all duration-300"
            >
              <i className="fa-regular fa-calendar-check mr-1.5 text-xs" /> {appointments.label}
            </Link>
          </nav>

          {/* Right action group: cart + mobile menu */}
          <div className="flex items-center gap-3">
            <CartIcon
              tenantSlug={tenantSlug}
              className="text-white hover:text-[#97c93e]"
            />
            <button
              className="md:hidden text-white hover:text-[#97c93e] text-2xl focus:outline-none p-1"
              aria-label="Open Mobile Menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <i className="fa-solid fa-bars-staggered" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-50 transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 w-72 bg-[#082017] border-l border-white/10 z-50 p-6 flex flex-col justify-between transition-transform duration-300 md:hidden shadow-2xl ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-[#97c93e]/40 flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={`${siteName} logo`} className="w-full h-full object-contain" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-[#051610] text-base font-bold">
                    W
                  </span>
                )}
              </div>
              <span className="font-cinzel tracking-widest text-lg font-bold text-[#97c93e]">
                {siteName}
              </span>
            </div>
            <button
              className="text-gray-400 hover:text-white text-xl p-1"
              aria-label="Close Mobile Menu"
              onClick={() => setMobileMenuOpen(false)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <nav className="flex flex-col gap-4 mt-6">
            {navItems.map((item, i) => (
              <Link
                key={i}
                href={resolveNavHref(item.href, tenantSlug)}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-medium flex items-center justify-between py-2 border-b border-white/5 ${
                  isActive(item.href) ? 'text-[#97c93e]' : 'text-gray-200 hover:text-[#97c93e]'
                }`}
              >
                <span>{item.label}</span>
                <i className="fa-solid fa-chevron-right text-xs" />
              </Link>
            ))}
            <Link
              href={resolveNavHref(appointments.href, tenantSlug)}
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-[#b2db58] flex items-center justify-between py-2 mt-2 bg-[#97c93e]/10 px-3 rounded-lg border border-[#97c93e]/30"
            >
              <span>
                <i className="fa-regular fa-calendar-check mr-2" /> {appointments.label}
              </span>
              <i className="fa-solid fa-arrow-right text-xs" />
            </Link>
          </nav>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
          <p className="text-xs text-gray-400">Pure Ayurvedic Healing &amp; Wellness</p>
          <div className="flex items-center gap-4 text-gray-400 text-base">
            <a href="#" aria-label="Twitter" className="hover:text-[#97c93e]">
              <i className="fa-brands fa-x-twitter" />
            </a>
            <a href="#" aria-label="Facebook" className="hover:text-[#97c93e]">
              <i className="fa-brands fa-facebook-f" />
            </a>
            <a href="#" aria-label="Instagram" className="hover:text-[#97c93e]">
              <i className="fa-brands fa-instagram" />
            </a>
            <a href="#" aria-label="YouTube" className="hover:text-[#97c93e]">
              <i className="fa-brands fa-youtube" />
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}