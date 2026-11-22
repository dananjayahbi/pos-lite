'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MergeCandidate {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

interface CustomerMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer that survives the merge. */
  primary: { id: string; name: string };
  onMerged?: () => void;
}

/**
 * ARGUS #320 - `customer:merge` existed with no UI, so duplicate/typo records
 * could only be archived one at a time (losing their sales history). This
 * dialog searches for the duplicate and folds it into the current customer;
 * the route re-checks the permission and tenant scope.
 */
export function CustomerMergeDialog({
  open,
  onOpenChange,
  primary,
  onMerged,
}: CustomerMergeDialogProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setDebounced('');
      setSelected(null);
    }
  }, [open]);

  const { data: candidates = [], isFetching } = useQuery<MergeCandidate[]>({
    queryKey: ['customer-merge-search', debounced],
    enabled: open && debounced.length > 0,
    queryFn: async () => {
      const res = await fetch(
        `/api/store/customers?search=${encodeURIComponent(debounced)}&limit=8`,
      );
      const json = await res.json();
      if (!res.ok || !json.success) return [];
      const rows = (json.data?.customers ?? []) as MergeCandidate[];
      return rows.filter((row) => row.id !== primary.id);
    },
  });

  async function handleMerge() {
    if (!selected) return;
    setMerging(true);
    try {
      const res = await fetch('/api/store/customers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId: primary.id, duplicateId: selected.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? 'Failed to merge customers');
        return;
      }
      toast.success(`${selected.name} merged into ${primary.name}`);
      onMerged?.();
      onOpenChange(false);
    } catch {
      toast.error('Failed to merge customers');
    } finally {
      setMerging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">Merge customer</DialogTitle>
          <DialogDescription>
            Move every sale, return, appointment and delivery from the duplicate into{' '}
            <span className="font-medium text-espresso">{primary.name}</span>. The duplicate is
            archived; its spend and store credit are added to this customer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="merge-search" className="text-sm text-sand-ink">
              Find the duplicate
            </Label>
            <Input
              id="merge-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelected(null);
              }}
              placeholder="Search by name or phone..."
              className="mt-1 border-mist"
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto" role="listbox" aria-label="Merge candidates">
            {debounced === '' ? (
              <p className="text-sm text-sand-ink">Type at least one character to search.</p>
            ) : isFetching && candidates.length === 0 ? (
              <p className="text-sm text-sand-ink">Searching...</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-sand-ink">No other customers match.</p>
            ) : (
              candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  aria-selected={selected?.id === candidate.id}
                  onClick={() => setSelected(candidate)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                    selected?.id === candidate.id
                      ? 'border-terracotta bg-terracotta/5 text-espresso'
                      : 'border-mist text-espresso hover:bg-linen/40'
                  }`}
                >
                  <span className="font-medium">{candidate.name}</span>
                  <span className="font-mono text-xs text-sand-ink">{candidate.phone}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleMerge()}
            disabled={!selected || merging}
            className="bg-terracotta text-pearl"
          >
            {merging ? 'Merging...' : 'Merge into this customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
