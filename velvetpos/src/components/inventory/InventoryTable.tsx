'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye, Archive, Trash2, Plus, Shirt } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ProductStatusBadge } from '@/components/inventory/ProductStatusBadge';
import { useInventorySelectionStore } from '@/stores/inventorySelectionStore';
import type { ProductListItem } from '@/hooks/useProducts';

interface InventoryTableProps {
  products: ProductListItem[];
  isLoading: boolean;
  permissions: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onArchive?: (id: string, isArchived: boolean) => void;
  onDelete?: (id: string) => void;
}

function ProductThumbnail({ variants }: { variants?: ProductListItem['variants'] }) {
  const firstImage = variants?.find((v) => v.imageUrls.length > 0)?.imageUrls[0];

  if (firstImage) {
    return (
      <Image
        src={firstImage}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 rounded-md object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mist/30">
      <Shirt className="h-5 w-5 text-mist" />
    </div>
  );
}

function GenderBadge({ gender }: { gender: string }) {
  const label = gender.charAt(0) + gender.slice(1).toLowerCase();
  return (
    <Badge variant="outline" className="font-body text-xs capitalize">
      {label}
    </Badge>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <Skeleton className="h-4 w-32" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function EmptyState({
  hasActiveFilters,
  onClearFilters,
  canCreate,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  canCreate: boolean;
}) {
  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <svg
          className="mb-4 h-16 w-16 text-mist"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M32 8 C24 8 18 14 18 22 L18 24 L14 24 L14 56 L50 56 L50 24 L46 24 L46 22 C46 14 40 8 32 8 Z" />
          <path d="M24 24 L24 22 C24 17.6 27.6 14 32 14 C36.4 14 40 17.6 40 22 L40 24" />
          <line x1="22" y1="34" x2="42" y2="34" />
        </svg>
        <h3 className="font-display text-lg text-espresso">No products match your filters</h3>
        <p className="mt-1 font-body text-sm text-mist">Try adjusting your search or filter criteria</p>
        <Button
          variant="outline"
          className="mt-4 border-sand text-espresso"
          onClick={onClearFilters}
        >
          Clear filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg
        className="mb-4 h-16 w-16 text-mist"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M32 8 C24 8 18 14 18 22 L18 24 L14 24 L14 56 L50 56 L50 24 L46 24 L46 22 C46 14 40 8 32 8 Z" />
        <path d="M24 24 L24 22 C24 17.6 27.6 14 32 14 C36.4 14 40 17.6 40 22 L40 24" />
      </svg>
      <h3 className="font-display text-lg text-espresso">No products yet</h3>
      <p className="mt-1 font-body text-sm text-mist">Start building your catalog</p>
      {canCreate && (
        <Button asChild className="mt-4 bg-espresso text-pearl hover:bg-espresso/90">
          <Link href="/inventory/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      )}
    </div>
  );
}

export function InventoryTable({
  products,
  isLoading,
  permissions,
  hasActiveFilters,
  onClearFilters,
  onArchive,
  onDelete,
}: InventoryTableProps) {
  const { selectedProductIds, toggleProduct, selectAll, isSelected } =
    useInventorySelectionStore();

  const canArchive = permissions.includes('product:archive');
  const canDelete = permissions.includes('product:delete');
  const canCreate = permissions.includes('product:create');

  const allIds = products.map((p) => p.id);
  const allSelected = products.length > 0 && allIds.every((id) => selectedProductIds.has(id));

  if (!isLoading && products.length === 0) {
    return (
      <EmptyState
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        canCreate={canCreate}
      />
    );
  }

  return (
    <div className="rounded-lg border border-sand/30 bg-pearl">
      <Table>
        <TableHeader>
          <TableRow className="bg-sand/20 hover:bg-sand/20">
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => selectAll(allIds)}
                aria-label="Select all products"
              />
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Product
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Category
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Brand
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Gender
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Variants
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Stock
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Status
            </TableHead>
            <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            products.map((product) => {
              const totalStock =
                product.variants?.reduce((sum, v) => sum + v.stockQuantity, 0) ?? 0;

              return (
                <TableRow
                  key={product.id}
                  className="bg-pearl hover:bg-terracotta/10"
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected(product.id)}
                      onCheckedChange={() => toggleProduct(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProductThumbnail variants={product.variants} />
                      <span className="font-body text-sm font-medium text-espresso">
                        {product.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-body text-sm text-espresso/70">
                    {product.category?.name ?? '—'}
                  </TableCell>
                  <TableCell className="font-body text-sm text-espresso/70">
                    {product.brand?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <GenderBadge gender={product.gender} />
                  </TableCell>
                  <TableCell className="font-body text-sm text-espresso/70">
                    {product._count.variants}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-espresso/70">
                    {totalStock}
                  </TableCell>
                  <TableCell>
                    <ProductStatusBadge
                      isArchived={product.isArchived}
                      variants={product.variants ?? []}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-espresso/60 hover:text-espresso"
                        asChild
                      >
                        <Link href={`/inventory/${product.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View {product.name}</span>
                        </Link>
                      </Button>
                      {canArchive && onArchive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-espresso/60 hover:text-espresso"
                          onClick={() => onArchive(product.id, !product.isArchived)}
                        >
                          <Archive className="h-4 w-4" />
                          <span className="sr-only">
                            {product.isArchived ? 'Unarchive' : 'Archive'} {product.name}
                          </span>
                        </Button>
                      )}
                      {canDelete && onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-espresso/60 hover:text-destructive"
                          onClick={() => onDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {product.name}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
