'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryTabsProps {
  categories: Array<{ id: string; name: string }>;
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}

const EDGE_THRESHOLD = 2;

export function CategoryTabs({
  categories,
  selectedCategoryId,
  onCategoryChange,
}: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > EDGE_THRESHOLD);
    setCanScrollRight(el.scrollLeft < maxScrollLeft - EDGE_THRESHOLD);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateArrows) : null;
    resizeObserver?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
      resizeObserver?.disconnect();
    };
  }, [updateArrows, categories.length]);

  const scrollByPage = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.75, 120);
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  // Native listener so preventDefault works (React's root wheel listener is passive).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      if (el.scrollWidth - el.clientWidth <= EDGE_THRESHOLD) return;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const pillClasses = (isSelected: boolean) =>
    `shrink-0 rounded-full px-4 min-h-11 inline-flex items-center justify-center font-body text-[13px] transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 ${
      isSelected
        ? 'bg-sand text-espresso border-b-2 border-sand'
        : 'bg-transparent text-terracotta hover:bg-sand/50'
    }`;

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      scrollRef.current?.querySelectorAll<HTMLElement>('[data-category-tab]') ?? [],
    );
    if (tabs.length === 0) return;
    const current = tabs.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;

    let next = current;
    switch (event.key) {
      case 'ArrowRight':
        next = current + 1;
        break;
      case 'ArrowLeft':
        next = current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = tabs[Math.min(Math.max(next, 0), tabs.length - 1)];
    target?.focus();
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        role="group"
        aria-label="Product categories"
        onKeyDown={handleTabKeyDown}
        className="flex gap-2 px-4 py-3 overflow-x-auto whitespace-nowrap"
        style={{ scrollbarWidth: 'none' }}
      >
        <button
          type="button"
          data-category-tab=""
          aria-pressed={selectedCategoryId === null}
          onClick={() => onCategoryChange(null)}
          className={pillClasses(selectedCategoryId === null)}
        >
          All Products
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            data-category-tab=""
            aria-pressed={selectedCategoryId === cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={pillClasses(selectedCategoryId === cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {canScrollLeft && (
        <ScrollArrow
          direction="left"
          label="Scroll categories left"
          onClick={() => scrollByPage('left')}
        />
      )}
      {canScrollRight && (
        <ScrollArrow
          direction="right"
          label="Scroll categories right"
          onClick={() => scrollByPage('right')}
        />
      )}
    </div>
  );
}

function ScrollArrow({
  direction,
  label,
  onClick,
}: {
  direction: 'left' | 'right';
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-mist bg-linen text-espresso shadow-sm transition-colors hover:bg-sand ${
        direction === 'left' ? 'left-1' : 'right-1'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
