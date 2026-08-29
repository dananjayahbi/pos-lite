'use client';

import React from 'react';

/** A single floating botanical icon that drifts on scroll (`.parallax-leaf`). */
export interface LeafSpec {
  /** Font Awesome icon class, e.g. 'fa-solid fa-leaf'. */
  icon: string;
  /** Tailwind positioning + size + colour classes. */
  classes: string;
  /** Parallax speed factor. */
  speed: number;
}

interface SectionAmbienceProps {
  leaves?: LeafSpec[];
  /** Tailwind classes for ambient glow orbs (e.g. '-top-20 left-1/3 w-96 h-96 bg-[#97c93e]'). */
  glows?: string[];
  /** Tailwind positioning classes for spotlight halos. */
  halos?: string[];
}

/**
 * Injects the decorative floating botanical leaves and ambient glow orbs used
 * across every dark section of the reference design. All nodes are animated by
 * the global useParallaxEngine() via their CSS classes.
 */
export function SectionAmbience({ leaves = [], glows = [], halos = [] }: SectionAmbienceProps) {
  return (
    <div aria-hidden className="pointer-events-none">
      {leaves.map((leaf, i) => (
        <div key={`leaf-${i}`} className={`parallax-leaf ${leaf.classes}`} data-speed={leaf.speed}>
          <i className={leaf.icon} />
        </div>
      ))}
      {glows.map((cls, i) => (
        <div key={`glow-${i}`} className={`ambient-glow ${cls}`} />
      ))}
      {halos.map((cls, i) => (
        <div key={`halo-${i}`} className={`spotlight-halo ${cls}`} />
      ))}
    </div>
  );
}
