'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCreateRawMaterialUnit,
  useDeleteRawMaterialUnit,
  useRawMaterialUnits,
  useUpdateRawMaterialUnit,
  type RawMaterialUnitItem,
} from '@/hooks/useRawMaterialUnits';
import { unitCapabilities } from '@/lib/services/rawMaterialUnitCapabilities.core';
import {
  unitDisplayChanged,
  unitRenameWarning,
} from '@/lib/services/rawMaterialUnitRename.core';
import { formatUnitUsage } from '@/lib/units/unitUsage.core';

interface UnitsPageClientProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface UnitFormState {
  name: string;
  shortLabel: string;
}

const EMPTY_FORM: UnitFormState = { name: '', shortLabel: '' };

export function UnitsPageClient({ canCreate, canEdit, canDelete }: UnitsPageClientProps) {
  const { data, isLoading, isError, error } = useRawMaterialUnits();
  const createMutation = useCreateRawMaterialUnit();
  const updateMutation = useUpdateRawMaterialUnit();
  const deleteMutation = useDeleteRawMaterialUnit();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterialUnitItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RawMaterialUnitItem | null>(null);
  const [form, setForm] = useState<UnitFormState>(EMPTY_FORM);
  /** Rename is display-only; a changed label needs an explicit acknowledgement. */
  const [renameConfirmed, setRenameConfirmed] = useState(false);

  const units = data?.data ?? [];
  const renameNeedsConfirmation =
    editing !== null &&
    unitDisplayChanged(
      { name: editing.name, shortLabel: editing.shortLabel },
      form,
    );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setRenameConfirmed(false);
    setFormOpen(true);
  };

  const openEdit = (unit: RawMaterialUnitItem) => {
    setEditing(unit);
    setForm({ name: unit.name, shortLabel: unit.shortLabel });
    setRenameConfirmed(false);
    setFormOpen(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    const shortLabel = form.shortLabel.trim();
    if (!name) return;
    if (renameNeedsConfirmation && !renameConfirmed) return;

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name,
          ...(shortLabel ? { shortLabel } : {}),
        });
        toast.success('Unit updated');
      } else {
        await createMutation.mutateAsync({
          name,
          ...(shortLabel ? { shortLabel } : {}),
        });
        toast.success('Unit added');
      }
      setFormOpen(false);
      setEditing(null);
      setRenameConfirmed(false);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Could not save unit');
    }
  };

  const toggleActive = async (unit: RawMaterialUnitItem) => {
    try {
      await updateMutation.mutateAsync({ id: unit.id, isActive: !unit.isActive });
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : 'Could not update unit');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Unit deleted');
      setDeleteTarget(null);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete unit');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Units</h1>
          <p className="mt-1 max-w-2xl font-body text-sm text-sand-ink">
            Units used across the system, including raw materials and bill-of-materials
            quantities. Built-in units can be renamed but not deactivated or deleted. A
            unit used by raw materials cannot be deleted until those materials are
            reassigned; archived references are shown in the Used by column.
          </p>
        </div>
        {canCreate && (
          <Button
            className="bg-espresso font-body text-pearl hover:bg-espresso/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-mist bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 font-body text-sm text-[#9B2226]">
            {error instanceof Error ? error.message : 'Could not load units'}
          </p>
        ) : units.length === 0 ? (
          <p className="p-6 font-body text-sm text-sand-ink">No units yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Short label</TableHead>
                <TableHead>Used by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => {
                const capabilities = unitCapabilities(unit);
                return (
                <TableRow key={unit.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-espresso">{unit.name}</span>
                      {unit.isBuiltIn && (
                        <Badge className="border border-sand/60 bg-linen text-sand-ink">
                          Built-in
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-mist-ink">
                    {unit.shortLabel}
                  </TableCell>
                  <TableCell className="font-body text-sm text-sand-ink">
                    {formatUnitUsage(unit.usageCount, unit.archivedUsageCount)}
                  </TableCell>
                  <TableCell>
                    {unit.isActive ? (
                      <Badge className="border border-green-200 bg-green-50 text-green-700">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="border border-mist bg-linen text-sand-ink">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(unit)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {capabilities.canActivate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void toggleActive(unit)}
                              disabled={updateMutation.isPending}
                            >
                              Activate
                            </Button>
                          )}
                          {capabilities.canDeactivate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void toggleActive(unit)}
                              disabled={updateMutation.isPending}
                            >
                              Deactivate
                            </Button>
                          )}
                        </>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#9B2226] hover:text-[#9B2226]/80"
                          onClick={() => {
                            if (capabilities.canDelete) setDeleteTarget(unit);
                          }}
                          disabled={!capabilities.canDelete}
                          title={capabilities.deleteBlockedReason ?? 'Delete unit'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setRenameConfirmed(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit unit' : 'Add unit'}</DialogTitle>
            <DialogDescription>
              The short label is what appears next to quantities (for example kg or L).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="unit-name">Name</Label>
              <Input
                id="unit-name"
                value={form.name}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, name: event.target.value }));
                  setRenameConfirmed(false);
                }}
                placeholder="e.g. Bottles"
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-short-label">Short label</Label>
              <Input
                id="unit-short-label"
                value={form.shortLabel}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, shortLabel: event.target.value }));
                  setRenameConfirmed(false);
                }}
                placeholder="e.g. bottle"
                maxLength={20}
              />
            </div>
            {renameNeedsConfirmation && editing && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">Display change only</p>
                <p className="mt-1 text-xs text-amber-800">
                  {unitRenameWarning(editing.key)}
                </p>
                <label className="mt-2 flex items-start gap-2 text-xs text-amber-900">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={renameConfirmed}
                    onChange={(event) => setRenameConfirmed(event.target.checked)}
                  />
                  <span>I understand existing quantities will not be converted.</span>
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={
                !form.name.trim() ||
                createMutation.isPending ||
                updateMutation.isPending ||
                (renameNeedsConfirmation && !renameConfirmed)
              }
            >
              {editing ? 'Save changes' : 'Add unit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete unit</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-espresso">{deleteTarget?.name}</span>? Units
              used by raw materials cannot be deleted. Remove or reassign those materials first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
