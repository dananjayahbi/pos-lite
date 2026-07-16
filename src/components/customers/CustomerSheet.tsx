'use client';

import { useState, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import {
  CreateCustomerSchema,
  type CreateCustomerInput,
} from '@/lib/validators/customer.validators';

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomerFromAPI {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  gender?: string | null;
  birthday?: string | null;
  tags: string[];
  notes?: string | null;
}

interface CustomerSheetProps {
  customer?: CustomerFromAPI | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ── Preset Tags ──────────────────────────────────────────────────────────────

const PRESET_TAGS = ['VIP', 'REGULAR', 'WHOLESALE', 'STAFF', 'ONLINE'];

// ── Component ────────────────────────────────────────────────────────────────

export function CustomerSheet({ customer, open, onOpenChange, onSuccess }: CustomerSheetProps) {
  const isEditing = !!customer;
  const [submitting, setSubmitting] = useState(false);
  const [tags, setTags] = useState<string[]>(customer?.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCustomerInput>({
    resolver: standardSchemaResolver(CreateCustomerSchema),
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? undefined,
      gender: (customer?.gender as CreateCustomerInput['gender']) ?? undefined,
      birthday: customer?.birthday ? customer.birthday.split('T')[0] : undefined,
      tags: customer?.tags ?? [],
      notes: customer?.notes ?? undefined,
    },
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
        setTags(customer?.tags ?? []);
        setTagInput('');
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, customer?.tags],
  );

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toUpperCase();
      if (normalized.length === 0) return;
      if (tags.includes(normalized)) return;
      const next = [...tags, normalized];
      setTags(next);
      (setValue as (name: string, value: unknown) => void)('tags', next);
    },
    [tags, setValue],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const next = tags.filter((t) => t !== tag);
      setTags(next);
      (setValue as (name: string, value: unknown) => void)('tags', next);
    },
    [tags, setValue],
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag(tagInput);
        setTagInput('');
      }
    },
    [addTag, tagInput],
  );

  const onSubmit = async (data: CreateCustomerInput) => {
    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/store/customers/${customer.id}`
        : '/api/store/customers';
      const method = isEditing ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        name: data.name,
        phone: data.phone,
        ...(data.email !== undefined && { email: data.email }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.birthday !== undefined && { birthday: data.birthday }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.notes !== undefined && { notes: data.notes }),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? 'Something went wrong');
        return;
      }

      toast.success(isEditing ? 'Customer updated' : 'Customer created');
      onSuccess();
      handleOpenChange(false);
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const genderValue = watch('gender');

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update customer information.'
              : 'Add a new customer to your directory.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register('name')} placeholder="Customer name" />
            {errors.name && (
              <p className="text-sm text-terracotta">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" {...register('phone')} placeholder="+94XXXXXXXXX" />
            {errors.phone && (
              <p className="text-sm text-terracotta">{errors.phone.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} placeholder="email@example.com" />
            {errors.email && (
              <p className="text-sm text-terracotta">{errors.email.message}</p>
            )}
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select
              value={genderValue ?? ''}
              onValueChange={(v) =>
                (setValue as (name: string, value: unknown) => void)('gender', v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Birthday */}
          <div className="space-y-1.5">
            <Label htmlFor="birthday">Birthday</Label>
            <Input id="birthday" type="date" {...register('birthday')} />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 hover:text-terracotta"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type and press Enter to add a tag"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="text-xs px-2 py-0.5 rounded-full border border-sand text-sand hover:bg-sand/10 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Any additional notes..."
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-terracotta">{errors.notes.message}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
