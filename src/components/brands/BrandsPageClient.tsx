'use client';

import { useState } from 'react';
import { useBrands } from '@/hooks/useBrands';
import { BrandsTable } from '@/components/brands/BrandsTable';
import { BrandEditSheet } from '@/components/brands/BrandEditSheet';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { Brand } from '@/hooks/useBrands';

interface BrandsPageClientProps {
  permissions: string[];
}

export function BrandsPageClient({ permissions }: BrandsPageClientProps) {
  const { data } = useBrands();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const brands = data?.data ?? [];
  const canEdit = permissions.includes('product:edit');
  const canDelete = permissions.includes('product:delete');

  function openCreate() {
    setEditingBrand(null);
    setSheetOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditingBrand(brand);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-espresso">Brands</h1>
          <p className="text-sm text-mist">
            {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-espresso text-pearl hover:bg-espresso/90"
          onClick={openCreate}
        >
          <Plus className="mr-1 h-4 w-4" />
          New Brand
        </Button>
      </div>

      <BrandsTable
        brands={brands}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={openEdit}
      />

      <BrandEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        brand={editingBrand}
      />
    </div>
  );
}
