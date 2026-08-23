'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RawMaterialStatusBadge } from '@/components/raw-materials/RawMaterialStatusBadge';
import { RawMaterialRowActions } from '@/components/raw-materials/RawMaterialRowActions';
import {
  getRawMaterialCategoryLabel,
  getUnitShortLabel,
} from '@/lib/services/rawMaterial.core';
import type { RawMaterialItem } from '@/hooks/useRawMaterials';

interface RawMaterialTableProps {
  materials: RawMaterialItem[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAdjust: boolean;
  onEdit: (material: RawMaterialItem) => void;
  onDelete: (material: RawMaterialItem) => void;
  onAdjust: (material: RawMaterialItem) => void;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="font-display text-lg text-espresso">No raw materials</h3>
      <p className="mt-1 font-body text-sm text-mist">
        Add a raw material to start tracking bulk stock.
      </p>
    </div>
  );
}

export function RawMaterialTable({
  materials,
  isLoading,
  canEdit,
  canDelete,
  canAdjust,
  onEdit,
  onDelete,
  onAdjust,
}: RawMaterialTableProps) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody><SkeletonRows /></TableBody>
      </Table>
    );
  }

  if (materials.length === 0) {
    return <EmptyState />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Low Threshold</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((material) => (
          <TableRow key={material.id}>
            <TableCell className="font-medium text-espresso">{material.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{getRawMaterialCategoryLabel(material.category)}</Badge>
            </TableCell>
            <TableCell className="text-mist">{getUnitShortLabel(material.unit)}</TableCell>
            <TableCell className="text-right font-semibold text-espresso">
              {material.quantity} {getUnitShortLabel(material.unit)}
            </TableCell>
            <TableCell>
              <RawMaterialStatusBadge status={material.stockStatus} />
            </TableCell>
            <TableCell className="text-right text-mist">{material.lowStockThreshold}</TableCell>
            <TableCell className="text-right">
              <RawMaterialRowActions
                canEdit={canEdit}
                canDelete={canDelete}
                canAdjust={canAdjust}
                onEdit={() => onEdit(material)}
                onDelete={() => onDelete(material)}
                onAdjust={() => onAdjust(material)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
