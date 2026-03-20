'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Brand } from '@/hooks/useBrands';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BrandEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand | null;
}

export function BrandEditSheet({ open, onOpenChange, brand }: BrandEditSheetProps) {
  const queryClient = useQueryClient();
  const isEdit = !!brand;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(brand?.name ?? '');
      setDescription(brand?.description ?? '');
    }
  }, [open, brand]);

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/api/store/brands/${brand.id}` : '/api/store/brands';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, string> = { name: name.trim() };
      if (description.trim()) body.description = description.trim();

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Failed to save brand');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success(isEdit ? 'Brand updated' : 'Brand created');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= 2 && trimmedName.length <= 60;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px]">
        <SheetHeader>
          <SheetTitle className="font-display text-espresso">
            {isEdit ? 'Edit Brand' : 'New Brand'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-mist">Brand Name *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nike"
              className="bg-pearl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-mist">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional brand description"
              className="bg-pearl resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-mist">Logo</Label>
            <div className="rounded-lg border border-dashed border-sand bg-linen p-6 text-center text-xs text-mist">
              Logo upload coming soon
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-espresso text-pearl hover:bg-espresso/90"
              disabled={!isValid || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
