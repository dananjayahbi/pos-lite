'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Brand } from '@/hooks/useBrands';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrandLogoUpload } from '@/components/brands/BrandLogoUpload';

interface BrandEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand | null;
}

export function BrandEditDialog({ open, onOpenChange, brand }: BrandEditDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!brand;

  // Key the inner form by `open` + `brand` so its state resets cleanly each
  // time the dialog is reopened with a different brand — no setState-in-effect.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <BrandEditForm
          key={`${brand?.id ?? 'new'}-${open}`}
          brand={brand}
          isEdit={isEdit}
          onOpenChange={onOpenChange}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['brands'] });
            queryClient.invalidateQueries({ queryKey: ['brand'] });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function BrandEditForm({
  brand,
  isEdit,
  onOpenChange,
  onSaved,
}: {
  brand: Brand | null;
  isEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(brand?.name ?? '');
  const [description, setDescription] = useState(brand?.description ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(brand?.logoUrl ?? null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit && !brand) throw new Error('Brand is required');
      const url = isEdit ? `/api/store/brands/${brand!.id}` : '/api/store/brands';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, string | null> = { name: name.trim() };
      if (description.trim()) body.description = description.trim();
      // Always send logoUrl so explicit removals (null) persist.
      body.logoUrl = logoUrl;

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
      toast.success(isEdit ? 'Brand updated' : 'Brand created');
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= 2 && trimmedName.length <= 60;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid && !mutation.isPending) mutation.mutate();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-espresso">
          {isEdit ? 'Edit Brand' : 'New Brand'}
        </DialogTitle>
        <DialogDescription className="text-mist">
          {isEdit
            ? 'Update the brand name and description.'
            : 'Create a new brand to group related products.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="brand-name" className="text-xs text-mist">
            Brand Name <span className="text-red-700">*</span>
          </Label>
          <Input
            id="brand-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nike"
            className="bg-pearl"
            maxLength={60}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="brand-description" className="text-xs text-mist">
            Description
          </Label>
          <Textarea
            id="brand-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional brand description"
            className="bg-pearl resize-none"
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-mist">Logo</Label>
          <BrandLogoUpload
            logoUrl={logoUrl}
            onChange={setLogoUrl}
            disabled={mutation.isPending}
          />
        </div>

        <DialogFooter className="-mx-4 -mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            className="border-sand text-espresso"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-espresso text-pearl hover:bg-espresso/90"
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
