'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBoms } from '@/hooks/useBom';
import { BomTable } from '@/components/bom/BomTable';
import { BomFormDialog } from '@/components/bom/BomFormDialog';
import { ProductionLogDialog } from '@/components/bom/ProductionLogDialog';

interface BomListClientProps {
  permissions: string[];
}

export function BomListClient({ permissions }: BomListClientProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [produceBomId, setProduceBomId] = useState<string | null>(null);

  const { data } = useBoms({
    ...(debounced ? { search: debounced } : {}),
    limit: 50,
  });

  const canCreate = permissions.includes('bom:create');
  const canEdit = permissions.includes('bom:edit');
  const canDelete = permissions.includes('bom:delete');
  const canProduce = permissions.includes('bom:produce');

  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Bill of Materials</h1>
          <p className="mt-1 font-body text-sm text-mist">
            Define the raw materials consumed to produce each finished good.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New BOM
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by finished product name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            const value = e.target.value;
            window.setTimeout(() => setDebounced(value), 300);
          }}
          className="max-w-sm"
        />
      </div>

      <BomTable
        items={items}
        canEdit={canEdit}
        canDelete={canDelete}
        canProduce={canProduce}
        onEdit={(id) => {
          setEditingBomId(id);
          setFormOpen(true);
        }}
        onProduce={(id) => setProduceBomId(id)}
      />

      <BomFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingBomId(null);
        }}
        editingBomId={editingBomId}
      />

      <ProductionLogDialog bomId={produceBomId} onClose={() => setProduceBomId(null)} />
    </div>
  );
}
