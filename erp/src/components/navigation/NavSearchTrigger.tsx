'use client';

import { SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavSearchTriggerProps {
  /** Called when the user presses the search button. */
  onOpen: () => void;
}

/**
 * Header trigger that opens the navigation search modal.
 * Renders a compact "Search" pill on desktop and an icon button on mobile.
 * The modal itself is owned by the layout so Ctrl/Cmd+K can share it.
 */
export default function NavSearchTrigger({ onOpen }: NavSearchTriggerProps) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden gap-1.5 text-sand hover:text-espresso md:inline-flex"
        onClick={onOpen}
      >
        <SearchIcon className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="ml-1 rounded border border-mist bg-linen px-1 text-[10px]">⌘K</kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Search pages"
        className="md:hidden"
        onClick={onOpen}
      >
        <SearchIcon className="h-5 w-5 text-espresso" />
      </Button>
    </>
  );
}

