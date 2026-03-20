'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Brand } from '@/hooks/useBrands';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';

interface BrandsTableProps {
  brands: Brand[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (brand: Brand) => void;
}

export function BrandsTable({ brands, canEdit, canDelete, onEdit }: BrandsTableProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to delete brand');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (brands.length === 0) {
    return (
      <div className="rounded-lg border border-sand bg-pearl p-8 text-center text-sm text-mist">
        No brands yet. Create your first brand above.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sand overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-sand hover:bg-sand">
            <TableHead className="text-espresso font-medium">Brand Name</TableHead>
            <TableHead className="text-espresso font-medium w-20">Logo</TableHead>
            <TableHead className="text-espresso font-medium w-32">Products</TableHead>
            <TableHead className="text-espresso font-medium w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.map((brand) => (
            <TableRow key={brand.id} className="bg-pearl hover:bg-terracotta/5">
              <TableCell className="font-body text-sm text-espresso">{brand.name}</TableCell>
              <TableCell>
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-mist/20 text-xs text-mist">
                    —
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-sand text-espresso text-xs">
                  {brand._count.products}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {canEdit && (
                    <button
                      type="button"
                      className="rounded p-1.5 text-mist hover:text-espresso"
                      onClick={() => onEdit(brand)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && brand._count.products === 0 && (
                    <button
                      type="button"
                      className="rounded p-1.5 text-mist hover:text-terracotta"
                      onClick={() => deleteMutation.mutate(brand.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
