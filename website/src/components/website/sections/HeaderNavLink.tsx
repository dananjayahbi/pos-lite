'use client';

import Link from 'next/link';

/**
 * Header nav link with the active-state underline styling from the reference
 * design. When active the underline is full-width; otherwise it animates in
 * on hover (via the parent `group` class).
 */
interface HeaderNavLinkProps {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}

export function HeaderNavLink({
  href,
  label,
  active,
  onNavigate,
}: HeaderNavLinkProps) {
  return (
    <Link
      href={href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={`text-sm font-medium tracking-wider uppercase transition-colors relative py-1 group ${
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
