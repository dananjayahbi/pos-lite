'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, UserRound, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CUSTOMER_SEARCH_MIN_LENGTH } from '@/lib/api/customers';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';

export interface PickedCustomer {
  id: string;
  name: string;
  phone: string;
}

interface CustomerPickerProps {
  /** Currently linked customer, or `null` for a walk-in / guest sale. */
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  label?: string;
  /** Shown under the field when nothing is selected. */
  guestHint?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Customer search for the back-office sales screens.
 *
 * Deliberately stateless with respect to the cart: the POS
 * `CustomerSearchDropdown` is coupled to the terminal's cart/store-credit
 * flow, so the management sheet uses this lean picker instead of duplicating
 * that logic. Selection is controlled — `null` means "guest / no customer",
 * which is what the create/update API persists as `customerId = null`.
 */
export function CustomerPicker({
  value,
  onChange,
  label = 'Customer',
  guestHint = 'No customer linked — the sale is recorded as a guest / walk-in.',
  disabled = false,
  className = '',
}: CustomerPickerProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { customers: options, isFetching } = useCustomerSearch({ search: debouncedSearch });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Label htmlFor="sale-customer-search" className="text-espresso mb-1.5 block text-xs font-semibold">
        {label}
      </Label>

      {value ? (
        <div className="border-mist bg-linen/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <div className="min-w-0">
            <p className="text-espresso truncate text-sm font-medium">{value.name}</p>
            <p className="text-sand font-mono text-xs">{value.phone}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="text-sand hover:text-terracotta shrink-0 transition-colors disabled:opacity-50"
            aria-label="Clear customer (record as guest)"
            title="Clear customer — record as guest"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="text-sand pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="sale-customer-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Guest / walk-in — search to link a customer"
              className="pl-9"
              autoComplete="off"
              disabled={disabled}
            />
            {isFetching && (
              <Loader2 className="text-sand absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
            )}
          </div>
          <p className="text-sand mt-1.5 flex items-start gap-1 text-xs leading-snug">
            <UserRound className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{guestHint}</span>
          </p>

          {showDropdown && debouncedSearch.trim().length >= CUSTOMER_SEARCH_MIN_LENGTH && (
            <div className="border-mist absolute top-full left-0 z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
              {options.length === 0 && !isFetching && (
                <p className="text-sand px-3 py-2 text-xs">No customers found</p>
              )}
              {options.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    onChange({ id: customer.id, name: customer.name, phone: customer.phone });
                    setSearch('');
                    setDebouncedSearch('');
                    setShowDropdown(false);
                  }}
                  className="hover:bg-linen flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors"
                >
                  <span className="text-espresso min-w-0 truncate font-medium">
                    {customer.name}
                  </span>
                  <span className="text-sand shrink-0 font-mono text-xs">{customer.phone}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
