'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { useCustomerCities } from '@/hooks/useCustomerCities';
import {
  customerToFormValues,
  type CustomerFormSource,
  type CustomerFormValues,
} from '@/lib/utils/customer-form';

// ── Types ────────────────────────────────────────────────────────────────────

type CustomerFromAPI = CustomerFormSource;

interface CustomerSheetProps {
  customer?: CustomerFromAPI | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ── Preset Tags ──────────────────────────────────────────────────────────────

const PRESET_TAGS = ['VIP', 'REGULAR', 'WHOLESALE', 'STAFF', 'ONLINE'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sand-ink">
      {children}
    </h3>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function CustomerSheet({ customer, open, onOpenChange, onSuccess }: CustomerSheetProps) {
  const isEditing = !!customer;
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const { data: citiesData, isLoading: citiesLoading } = useCustomerCities(open);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A stable signature of the values currently being edited. Depending on the
  // object identity itself caused a background list refetch to reset the form
  // while the user was typing; the serialized values only change when the
  // customer's data actually changes.
  const customerSignature = useMemo(
    () => (customer ? JSON.stringify(customerToFormValues(customer)) : 'NEW'),
    [customer],
  );

  // M05-01/02: the schema now transforms its output ('' → undefined email,
  // birthday coerced to a Date), so the form fields are typed from the raw
  // input shape and handleSubmit receives the parsed output shape.
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues, unknown, CreateCustomerInput>({
    resolver: standardSchemaResolver(CreateCustomerSchema),
    defaultValues: customerToFormValues(customer),
  });

  // Re-apply the current customer whenever the sheet opens (or the selected
  // customer's data changes). `useForm` only captures defaultValues at mount,
  // and the sheet stays mounted for the page lifetime. The editable tags live
  // in the form, so a single `reset` restores them too.
  useEffect(() => {
    if (!open) return;
    reset(customerToFormValues(customer));
    // A drawer reused from a previous (scrolled) form must start at the top so
    // the Name/Phone fields are the first thing the user sees.
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
    // `customerSignature` deliberately substitutes for the `customer` object:
    // a background list refetch produces a new object with identical values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerSignature, reset]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset(customerToFormValues(customer));
        setTagInput('');
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, customer],
  );

  const watchedTags = useWatch({ control, name: 'tags' });
  const tags = useMemo(() => watchedTags ?? [], [watchedTags]);

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toUpperCase();
      if (normalized.length === 0) return;
      if (tags.includes(normalized)) return;
      const next = [...tags, normalized];
      (setValue as (name: string, value: unknown) => void)('tags', next);
    },
    [tags, setValue],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const next = tags.filter((t) => t !== tag);
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
        // Always send these optional fields so clearing them on edit persists
        // (the service maps '' → null on PATCH).
        phone2: data.phone2 ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        ...(data.email !== undefined && { email: data.email }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.birthday !== undefined && { birthday: data.birthday }),
        tags: data.tags ?? [],
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

  const genderValue = useWatch({ control, name: 'gender' });
  const cityValue = useWatch({ control, name: 'city' });

  // Keep an existing/legacy city visible even when the master list has not
  // loaded it yet (or no longer contains it).
  const cityOptions = useMemo(() => {
    const base = citiesData?.cities ?? [];
    const current = (cityValue ?? '').trim();
    if (current.length === 0) return base;
    if (base.some((option) => option.value.toLowerCase() === current.toLowerCase())) {
      return base;
    }
    return [...base, { value: current, label: current }].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [citiesData?.cities, cityValue]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-sand/20 px-6 pt-6 pb-5 pr-12">
          <SheetTitle className="font-display text-xl">
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update customer information and contact details.'
              : 'Add a new customer to your directory.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-8">
          {/* Contact details */}
          <div className="space-y-4">
            <SectionTitle>Contact details</SectionTitle>

            <div className="space-y-1.5">
              <Label htmlFor="name">
                Name <span className="text-terracotta">*</span>
              </Label>
              <Input
                id="name"
                autoComplete="name"
                {...register('name')}
                placeholder="Customer name"
              />
              {errors.name && (
                <p className="text-sm text-terracotta">{errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Phone <span className="text-terracotta">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  {...register('phone')}
                  placeholder="+94XXXXXXXXX"
                />
                {errors.phone && (
                  <p className="text-sm text-terracotta">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone2" className="flex items-baseline gap-1.5">
                  Contact No 2
                  <span className="text-xs font-normal text-sand-ink">(optional)</span>
                </Label>
                <Input
                  id="phone2"
                  type="tel"
                  autoComplete="tel"
                  {...register('phone2')}
                  placeholder="+94XXXXXXXXX"
                />
                {errors.phone2 && (
                  <p className="text-sm text-terracotta">{errors.phone2.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="text-sm text-terracotta">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="mt-6 space-y-4 border-t border-sand/20 pt-5">
            <SectionTitle>Address</SectionTitle>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                autoComplete="street-address"
                {...register('address')}
                placeholder="Street, building, apartment..."
                rows={2}
                className="resize-none"
              />
              {errors.address && (
                <p className="text-sm text-terracotta">{errors.address.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="city">City</Label>
                {cityValue ? (
                  <button
                    type="button"
                    onClick={() =>
                      (setValue as (name: string, value: unknown) => void)('city', '')
                    }
                    className="text-xs text-sand-ink underline-offset-2 hover:text-terracotta hover:underline"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <Select
                value={cityValue ?? ''}
                onValueChange={(v) =>
                  (setValue as (name: string, value: unknown) => void)('city', v)
                }
              >
                <SelectTrigger id="city" className="w-full">
                  <SelectValue
                    placeholder={citiesLoading ? 'Loading cities...' : 'Select city'}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {cityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-sand-ink">
                {citiesLoading
                  ? 'Loading Trans Express city list...'
                  : citiesData?.source === 'TRANSEXPRESS'
                    ? 'City list synced from Trans Express courier locations.'
                    : 'Showing common cities. Sync Trans Express locations in Delivery settings for the full list.'}
              </p>
              {errors.city && (
                <p className="text-sm text-terracotta">{errors.city.message}</p>
              )}
            </div>
          </div>

          {/* Personal details */}
          <div className="mt-6 space-y-4 border-t border-sand/20 pt-5">
            <SectionTitle>Personal details</SectionTitle>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={genderValue ?? ''}
                  onValueChange={(v) =>
                    (setValue as (name: string, value: unknown) => void)('gender', v)
                  }
                >
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="birthday">Birthday</Label>
                <Input id="birthday" type="date" {...register('birthday')} />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mt-6 space-y-3 border-t border-sand/20 pt-5">
            <SectionTitle>Tags</SectionTitle>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:text-terracotta"
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type and press Enter to add a tag"
            />

            {PRESET_TAGS.filter((t) => !tags.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="rounded-full border border-sand px-2.5 py-1 text-xs text-sand-ink transition-colors hover:bg-sand/10"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mt-6 space-y-1.5 border-t border-sand/20 pt-5">
            <SectionTitle>Notes</SectionTitle>
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

          </div>

          {/* Submit */}
          <div className="flex shrink-0 justify-end gap-2 border-t border-sand/20 bg-background/95 px-6 py-4">
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
