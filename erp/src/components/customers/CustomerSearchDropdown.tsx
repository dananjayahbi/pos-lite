'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LoyaltyBadge } from '@/components/customers/LoyaltyBadge';
import { CUSTOMER_SEARCH_MIN_LENGTH } from '@/lib/api/customers';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';

interface CustomerSearchDropdownProps {
  onSelect: (customer: { id: string; name: string; phone: string; creditBalance: string }) => void;
  /** Optional id so the POS shell can target the field from a shortcut. */
  inputId?: string;
  /** Called on Escape so the POS can hand focus back to the barcode box. */
  onCancel?: () => void;
}

export function CustomerSearchDropdown({ onSelect, inputId, onCancel }: CustomerSearchDropdownProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      // A new result set starts without a highlighted row.
      setActiveIndex(-1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { customers } = useCustomerSearch({ search: debouncedSearch, limit: 5 });

  const selectCustomer = (customer: (typeof customers)[number]) => {
    onSelect({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      creditBalance: String(customer.creditBalance),
    });
    setSearch('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const resultsOpen = open && customers.length > 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (customers.length === 0) return;
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, customers.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      const customer = resultsOpen ? customers[activeIndex] : undefined;
      if (customer) {
        event.preventDefault();
        selectCustomer(customer);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      onCancel?.();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mist-ink" />
        <Input
          ref={inputRef}
          id={inputId}
          placeholder="Link customer..."
          value={search}
          role="combobox"
          aria-autocomplete="list"
          aria-keyshortcuts="Alt+C"
          aria-expanded={resultsOpen}
          aria-controls="pos-customer-search-results"
          aria-activedescendant={
            resultsOpen && activeIndex >= 0 ? `pos-customer-option-${activeIndex}` : undefined
          }
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (debouncedSearch.length >= CUSTOMER_SEARCH_MIN_LENGTH) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="pl-8 h-8 text-sm"
        />
      </div>
      {resultsOpen && (
        <div
          id="pos-customer-search-results"
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-pearl border border-mist rounded-lg shadow-lg overflow-hidden"
        >
          {customers.map((c, index) => (
            <button
              key={c.id}
              id={`pos-customer-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`w-full text-left px-3 py-2 transition-colors ${
                index === activeIndex ? 'bg-linen' : 'hover:bg-linen'
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectCustomer(c)}
            >
              <p className="font-body text-sm text-espresso font-medium flex items-center gap-1.5">
                {c.name}
                <LoyaltyBadge orderCount={c.orderCount} size="sm" />
              </p>
              <p className="font-mono text-xs text-mist-ink">{c.phone}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
