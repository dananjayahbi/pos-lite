'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  CreateSupplierSchema,
  type CreateSupplierInput,
} from '@/lib/validators/supplier.validators';

// ── Types ────────────────────────────────────────────────────────────────────

interface SupplierFromAPI {
  id: string;
  name: string;
  contactName?: string | null;
  phone: string;
  whatsappNumber?: string | null;
  email?: string | null;
  address?: string | null;
  leadTimeDays: number;
  notes?: string | null;
}

interface SupplierSheetProps {
  supplier?: SupplierFromAPI | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ── Form values ──────────────────────────────────────────────────────────────

const toFormValues = (supplier?: SupplierFromAPI): CreateSupplierInput => ({
  name: supplier?.name ?? '',
  contactName: supplier?.contactName ?? undefined,
  phone: supplier?.phone ?? '',
  whatsappNumber: supplier?.whatsappNumber ?? undefined,
  email: supplier?.email ?? undefined,
  address: supplier?.address ?? undefined,
  leadTimeDays: supplier?.leadTimeDays ?? 7,
  notes: supplier?.notes ?? undefined,
});

// ── Component ────────────────────────────────────────────────────────────────

export function SupplierSheet({ supplier, open, onOpenChange, onSuccess }: SupplierSheetProps) {
  const isEditing = !!supplier;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSupplierInput>({
    resolver: standardSchemaResolver(CreateSupplierSchema),
    defaultValues: toFormValues(supplier),
  });

  // BUG-34 (M06-04): useForm captures defaultValues once at mount, but the
  // sheet stays mounted for the page lifetime, so the FIRST edit-open showed
  // blank fields. Re-apply the current supplier's values on every open (and
  // whenever the selected supplier changes while mounted); create mode
  // (no supplier) resets to empty.
  useEffect(() => {
    if (open) {
      reset(toFormValues(supplier));
    }
  }, [open, supplier, reset]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset(toFormValues(supplier));
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, supplier],
  );

  const onSubmit = async (data: CreateSupplierInput) => {
    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/store/suppliers/${supplier.id}`
        : '/api/store/suppliers';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!json.success) {
        toast.error(json.error?.message ?? 'Something went wrong');
        return;
      }

      toast.success(isEditing ? 'Supplier updated' : 'Supplier created');
      handleOpenChange(false);
      onSuccess();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">{isEditing ? 'Edit Supplier' : 'Add Supplier'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update supplier details.' : 'Create a new supplier.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register('name')} placeholder="Supplier name" />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>

          {/* Contact Name */}
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Contact Person</Label>
            <Input id="contactName" {...register('contactName')} placeholder="Contact person name" />
            {errors.contactName && <p className="text-sm text-red-600">{errors.contactName.message}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" {...register('phone')} placeholder="+94XXXXXXXXX or 07XXXXXXXX" />
            {errors.phone && <p className="text-sm text-red-600">{errors.phone.message}</p>}
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-1.5">
            <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
            <Input id="whatsappNumber" {...register('whatsappNumber')} placeholder="+94XXXXXXXXX or 07XXXXXXXX" />
            <p className="text-xs text-muted-foreground">Leave blank to use same as Phone</p>
            {errors.whatsappNumber && <p className="text-sm text-red-600">{errors.whatsappNumber.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} placeholder="email@example.com" />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" {...register('address')} placeholder="Supplier address" rows={3} />
            {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
          </div>

          {/* Lead Time Days */}
          <div className="space-y-1.5">
            <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
            <Input
              id="leadTimeDays"
              type="number"
              {...register('leadTimeDays', {
                // BUG-33 (M06-03): valueAsNumber turns an empty input into
                // NaN, which the resolver rejects with a raw message. Do the
                // same numeric coercion via setValueAs, mapping empty or
                // invalid input to undefined so .optional() passes and the
                // API default (7) applies. (valueAsNumber takes precedence
                // over setValueAs in RHF, so it must not be combined.)
                setValueAs: (value) => {
                  if (value === '' || value === null || value === undefined) {
                    return undefined;
                  }
                  const n = typeof value === 'number' ? value : Number(value);
                  return Number.isNaN(n) ? undefined : n;
                },
              })}
              placeholder="7"
              min={1}
              max={365}
            />
            {errors.leadTimeDays && <p className="text-sm text-red-600">{errors.leadTimeDays.message}</p>}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} placeholder="Additional notes" rows={3} />
            {errors.notes && <p className="text-sm text-red-600">{errors.notes.message}</p>}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? 'Saving…' : isEditing ? 'Update Supplier' : 'Create Supplier'}
            </Button>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
