'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import { poQueryKeys } from './poQueryKeys';

/**
 * Supplier picker for the create form. Shares the cached supplier list with the
 * suppliers page so switching between them costs no extra request.
 */
interface SupplierOption {
  id: string;
  name: string;
}

interface POSupplierFieldProps {
  value: string;
  onChange: (supplierId: string) => void;
  error?: string | undefined;
  disabled?: boolean | undefined;
}

export function POSupplierField({ value, onChange, error, disabled }: POSupplierFieldProps) {
  const { data, isLoading } = useQuery<{ success: boolean; data: { suppliers: SupplierOption[] } }>({
    queryKey: poQueryKeys.supplierOptions(),
    queryFn: () => fetch('/api/store/suppliers?limit=100').then((r) => r.json()),
    staleTime: 60_000,
  });

  const suppliers = data?.data?.suppliers ?? [];

  return (
    <div className="space-y-1.5">
      <Label htmlFor="po-supplier">Supplier *</Label>
      <Select
        value={value}
        onValueChange={onChange}
        {...(disabled !== undefined ? { disabled } : {})}
      >
        <SelectTrigger id="po-supplier" className="w-full">
          <SelectValue placeholder={isLoading ? 'Loading suppliers…' : 'Select a supplier'} />
        </SelectTrigger>
        <SelectContent>
          {suppliers.map((supplier) => (
            <SelectItem key={supplier.id} value={supplier.id}>
              {supplier.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
