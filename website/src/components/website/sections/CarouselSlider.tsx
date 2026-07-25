'use client';

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselSliderProps {
  /** Unique id for the slider (used for nav button aria labels) */
  sliderId: string;
  /** Children cards to render in the grid */
  children: React.ReactNode;
  /** Number of cards visible on desktop (default 4) */
  desktopCards?: number;
  /** Number of cards visible on tablet (default 3) */
  tabletCards?: number;
  /** Number of cards visible on mobile (default 2) */
  mobileCards?: number;
  /** Gap between cards in px (default 16) */
  gap?: number;
  /** Optional class for the outer wrapper */
  className?: string;
  /** Enable infinite scroll via triple-duplicate technique (default false) */
  infinite?: boolean;
}

/**
 * Shared 1D grid horizontal carousel slider with scroll snap.
 * Used by Image Slider (S02), Top Selling (S03), Categories (S05),
 * and Latest Products (S06).
 */
export function CarouselSlider({
  sliderId,
  children,
  desktopCards = 4,
  tabletCards = 3,
  mobileCards = 2,
  gap = 16,
  className = '',
  infinite = false,
}: CarouselSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);

  // Triple children for infinite scroll (3 copies: [children, children, children])
  const childrenArray = useMemo(() => React.Children.toArray(children), [children]);
  const tripledChildren = useMemo(
    () => [
      ...childrenArray.map((child, i) =>
        React.cloneElement(child as React.ReactElement, { key: `dup1-${i}` }),
      ),
      ...childrenArray.map((child, i) =>
        React.cloneElement(child as React.ReactElement, { key: `dup2-${i}` }),
      ),
      ...childrenArray.map((child, i) =>
        React.cloneElement(child as React.ReactElement, { key: `dup3-${i}` }),
      ),
    ],
    [childrenArray],
  );

  // Infinite scroll: set initial position to middle copy and handle boundary jumps
  useEffect(() => {
    if (!infinite || childrenArray.length === 0) return;
    const slider = sliderRef.current;
    if (!slider) return;

    // Set initial scroll to the middle copy after layout
    const raf = requestAnimationFrame(() => {
      const oneSetWidth = slider.scrollWidth / 3;
      slider.scrollLeft = oneSetWidth;
    });

    const handleScroll = () => {
      const oneSetWidth = slider.scrollWidth / 3;
      if (slider.scrollLeft < 50) {
        slider.scrollLeft += oneSetWidth;
      } else if (slider.scrollLeft + slider.clientWidth > slider.scrollWidth - 50) {
        slider.scrollLeft -= oneSetWidth;
      }
    };

    slider.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      slider.removeEventListener('scroll', handleScroll);
    };
  }, [infinite, childrenArray]);

  const getScrollAmount = useCallback(() => {
    const slider = sliderRef.current;
    if (!slider) return 300;
    const firstCard = slider.querySelector(':scope > *');
    if (!firstCard) return 300;
    return firstCard.getBoundingClientRect().width + gap;
  }, [gap]);

  const scroll = useCallback(
    (direction: 'prev' | 'next') => {
      const amount = getScrollAmount();
      if (sliderRef.current) {
        sliderRef.current.scrollBy({
          left: direction === 'next' ? amount : -amount,
          behavior: 'smooth',
        });
      }
    },
    [getScrollAmount],
  );

  const desktopCols = `calc(${100 / desktopCards}% - ${gap - gap / desktopCards}px)`;
  const tabletCols = `calc(${100 / tabletCards}% - ${gap - gap / tabletCards}px)`;
  const mobileCols = `calc(${100 / mobileCards}% - ${gap - gap / mobileCards}px)`;

  return (
    <div className={`relative ${className} px-0 md:px-0`}> 
      {/* Prev button */}
      <button
        onClick={() => scroll('prev')}
        aria-label={`${sliderId} previous`}
        className="nav-btn nav-btn-prev"
      >
        <ChevronLeft size={18} />
      </button>

      {/* Next button */}
      <button
        onClick={() => scroll('next')}
        aria-label={`${sliderId} next`}
        className="nav-btn nav-btn-next"
      >
        <ChevronRight size={18} />
      </button>

      {/* Slider track */}
      <div
        ref={sliderRef}
        className="carousel-track"
        style={{
          gap: `${gap}px`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          '--desktop-cols': desktopCols,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          '--tablet-cols': tabletCols,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          '--mobile-cols': mobileCols,
        } as React.CSSProperties}
      >
        {infinite ? tripledChildren : children}
      </div>

      <style jsx>{`
        .nav-btn {
          position: absolute;
          top: 40%;
          transform: translateY(-50%);
          width: 40px;
          height: 40px;
          background-color: rgba(255, 255, 255, 0.9);
          border: 1px solid #e0e0e0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          transition: background-color 0.2s ease, transform 0.2s ease;
          color: #333;
        }
        .nav-btn:hover {
          background-color: #fff;
          transform: translateY(-50%) scale(1.05);
        }
        .nav-btn-prev {
          left: 0;
        }
        .nav-btn-next {
          right: 0;
        }
        .carousel-track {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: var(--desktop-cols);
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          padding-bottom: 10px;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .carousel-track::-webkit-scrollbar {
          display: none;
        }
        .carousel-track > :global(*) {
          scroll-snap-align: start;
        }
        @media (max-width: 900px) {
          .carousel-track {
            grid-auto-columns: var(--tablet-cols);
          }
        }
        @media (max-width: 600px) {
          .carousel-track {
            grid-auto-columns: var(--mobile-cols);
          }
        }
      `}</style>
    </div>
  );
}
