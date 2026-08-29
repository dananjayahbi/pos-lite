/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { WebsiteConfigData } from '@/types/website.types';
import { tenantHomePath } from '@/lib/tenant';
import { ROUTES } from '@/config/site';
import { CartIcon } from '@/components/website/cart/CartIcon';

interface WebsiteHeaderProps {
  config: WebsiteConfigData;
  tenantSlug: string;
}

/** Nav link with the active-state underline styling from the reference design. */
function NavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={`text-sm font-medium tracking-wider uppercase transition-colors relative py-1 ${
        active ? 'text-white' : 'text-gray-300 hover:text-[#97c93e]'
      }`}
    >
      {label}
      <span
        className={`absolute bottom-0 left-0 h-[2px] bg-[#97c93e] transition-all duration-300 ${
          active ? 'w-full' : 'w-0 group-hover:w-full'
        }`}
      />
    </Link>
  );
}

/**
 * Fixed dark-glass luxury header for the storefront.
 *
 * Structure (from the reference design):
 *   - left: logo mark (rounded white tile) + "WEDAGEDARA" + "Ayurvedic Heritage"
 *   - center (desktop): HOME / ABOUT / SHOP / CONTACT + Appointments pill
 *   - right: cart toggle + mobile hamburger
 * Gets a frosted `.glass-nav` + shrink effect when scrolled past 40px.
 */
export function WebsiteHeader({ config, tenantSlug }: WebsiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const logoUrl = config.logoUrl;
  const siteName = config.siteName || 'Wedagedara';
  const homeHref = tenantHomePath(tenantSlug);

  // Track scroll to apply the glass + shrink header.
  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Default nav items if none configured: SHOP, ABOUT, CONTACT, Appointments.
  const defaultNav = [
    { label: 'SHOP', href: '/shop' },
    { label: 'ABOUT', href: '/about' },
    { label: 'CONTACT', href: '/contact' },
  ];
  const baseNav = (config.navItems && config.navItems.length > 0
    ? config.navItems
    : defaultNav) as { label: string; href: string }[];

  // Prepend HOME (always first) and append the Appointments pill link.
  const appointments =
    config.appointments?.enabled && config.appointments.navLabel
      ? { label: config.appointments.navLabel, href: ROUTES.appointments(tenantSlug) }
      : null;
  const navItems = [{ label: 'HOME', href: homeHref }, ...baseNav];

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

  const isActive = (href: string) => {
    if (href === homeHref || href === '/') return pathname === '/' || pathname === homeHref;
    const resolved = resolveNavHref(href).replace(/\/$/, '');
    return pathname === resolved || pathname.startsWith(`${resolved}/`);
  };

  return (
    <>
      <header
        id="main-header"
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 px-6 sm:px-10 lg:px-16 py-5 ${
          scrolled ? 'glass-nav py-3.5 shadow-2xl' : ''
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
              <NavLink
                key={i}
                href={resolveNavHref(item.href)}
                label={item.label}
                active={isActive(item.href)}
              />
            ))}
            {appointments && (
              <Link
                href={resolveNavHref(appointments.href)}
                className="text-sm font-semibold tracking-wider uppercase px-4 py-2 rounded-full border border-[#97c93e]/40 text-[#b2db58] hover:bg-[#97c93e] hover:text-black transition-all duration-300"
              >
                <i className="fa-regular fa-calendar-check mr-1.5 text-xs" /> {appointments.label}
              </Link>
            )}
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
                href={resolveNavHref(item.href)}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-medium flex items-center justify-between py-2 border-b border-white/5 ${
                  isActive(item.href) ? 'text-[#97c93e]' : 'text-gray-200 hover:text-[#97c93e]'
                }`}
              >
                <span>{item.label}</span>
                <i className="fa-solid fa-chevron-right text-xs" />
              </Link>
            ))}
            {appointments && (
              <Link
                href={resolveNavHref(appointments.href)}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-[#b2db58] flex items-center justify-between py-2 mt-2 bg-[#97c93e]/10 px-3 rounded-lg border border-[#97c93e]/30"
              >
                <span>
                  <i className="fa-regular fa-calendar-check mr-2" /> {appointments.label}
                </span>
                <i className="fa-solid fa-arrow-right text-xs" />
              </Link>
            )}
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