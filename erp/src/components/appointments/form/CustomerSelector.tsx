'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

interface CustomerSelectorProps {
  value: string | null;
  onChange: (customerId: string | null, customerData?: { name: string; phone: string }) => void;
  onWalkInChange: (name: string, phone: string) => void;
  walkInName: string;
  walkInPhone: string;
}

export function CustomerSelector({ value, onChange, onWalkInChange, walkInName, walkInPhone }: CustomerSelectorProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);

  const { data } = useQuery({
    queryKey: ['customers', 'search', search],
    queryFn: async () => {
      const res = await fetch(`/api/store/customers?search=${encodeURIComponent(search)}&limit=20`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      return json.data as { customers: CustomerOption[] };
    },
    enabled: search.length >= 2,
    staleTime: 60_000,
  });

  const customers = data?.customers ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Customer</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowWalkIn(!showWalkIn)}
          className="text-xs text-espresso/60"
        >
          <UserPlus className="h-3 w-3 mr-1" />
          {showWalkIn ? 'Select Existing' : 'Walk-in'}
        </Button>
      </div>

      {!showWalkIn ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between">
              {value ? customers.find((c) => c.id === value)?.name ?? 'Selected' : 'Search customers...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <div className="p-2">
              <Input
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-[200px] overflow-auto space-y-1">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-espresso/5"
                    onClick={() => { onChange(c.id, { name: c.name, phone: c.phone }); setOpen(false); }}
                  >
                    <span>{c.name}</span>
                    <span className="text-espresso/40 text-xs">{c.phone}</span>
                    {value === c.id && <Check className="h-4 w-4 text-green-500" />}
                  </button>
                ))}
                {customers.length === 0 && search.length >= 2 && (
                  <p className="text-sm text-espresso/40 text-center py-4">No customers found</p>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={walkInName}
              onChange={(e) => onWalkInChange(e.target.value, walkInPhone)}
              placeholder="Walk-in name"
            />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input
              value={walkInPhone}
              onChange={(e) => onWalkInChange(walkInName, e.target.value)}
              placeholder="Phone number"
            />
          </div>
        </div>
      )}
    </div>
  );
}
