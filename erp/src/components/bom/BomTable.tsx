'use client';

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeleteBom, type BomItemView } from '@/hooks/useBom';

interface BomTableProps {
  items: BomItemView[];
  canEdit: boolean;
  canDelete: boolean;
  canProduce: boolean;
  onEdit: (id: string) => void;
  onProduce: (id: string) => void;
}

export function BomTable({
  items,
  canEdit,
  canDelete,
  canProduce,
  onEdit,
  onProduce,
}: BomTableProps) {
  const deleteMutation = useDeleteBom();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete BOM "${name}"?`)) return;
    setDeletingId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('BOM deleted'),
      onError: (err: Error) => toast.error(err.message),
      onSettled: () => setDeletingId(null),
    });
  };
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <FlaskConical className="mx-auto h-8 w-8 text-mist" />
        <p className="mt-3 text-sm text-mist">
          No bills of materials yet. Create one to start tracking production.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Finished product</TableHead>
            <TableHead>Ingredients</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((bom) => (
            <TableRow key={bom.id}>
              <TableCell className="font-medium text-espresso">{bom.name}</TableCell>
              <TableCell>
                <div className="text-sm text-espresso">{bom.variantName}</div>
                <div className="text-xs text-mist">{bom.variantSku}</div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-mist">{bom.rawMaterialCount} materials</span>
              </TableCell>
              <TableCell>
                <Badge variant={bom.isActive ? 'default' : 'secondary'}>
                  {bom.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {canProduce && bom.isActive && (
                    <Button variant="outline" size="sm" onClick={() => onProduce(bom.id)}>
                      Produce
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => onEdit(bom.id)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      disabled={deletingId === bom.id}
                      onClick={() => handleDelete(bom.id, bom.name)}
                    >
                      {deletingId === bom.id ? 'Deleting…' : 'Delete'}
                    </Button>
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
