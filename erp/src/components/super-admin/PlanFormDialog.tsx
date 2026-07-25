'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { SerializedPlan } from '@/components/super-admin/PlansClient';

const planFormSchema = z.object({
  name: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']),
  monthlyPrice: z.number().positive('Must be positive'),
  annualPrice: z.number().positive('Must be positive'),
  maxUsers: z.int().min(1, 'At least 1'),
  maxProductVariants: z.int().min(1, 'At least 1'),
  features: z.array(z.object({ value: z.string().min(1, 'Feature cannot be empty') })).min(1, 'At least one feature required'),
  isActive: z.boolean(),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

interface PlanFormDialogProps {
  existingPlan?: SerializedPlan | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PlanFormDialog({
  existingPlan,
  open,
  onOpenChange,
  onSuccess,
}: PlanFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!existingPlan;

  const form = useForm<PlanFormValues>({
    resolver: standardSchemaResolver(planFormSchema),
    defaultValues: existingPlan
      ? {
          name: existingPlan.name as PlanFormValues['name'],
          monthlyPrice: existingPlan.monthlyPrice,
          annualPrice: existingPlan.annualPrice,
          maxUsers: existingPlan.maxUsers,
          maxProductVariants: existingPlan.maxProductVariants,
          features: existingPlan.features.map((f) => ({ value: f })),
          isActive: existingPlan.isActive,
        }
      : {
          name: 'STARTER' as const,
          monthlyPrice: 0,
          annualPrice: 0,
          maxUsers: 1,
          maxProductVariants: 1,
          features: [{ value: '' }],
          isActive: true,
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'features',
  });

  const onSubmit = async (values: PlanFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        monthlyPrice: values.monthlyPrice,
        annualPrice: values.annualPrice,
        maxUsers: values.maxUsers,
        maxProductVariants: values.maxProductVariants,
        features: values.features.map((f) => f.value),
        ...(isEdit ? { isActive: values.isActive } : {}),
      };

      const url = isEdit
        ? `/api/admin/plans/${existingPlan.id}`
        : '/api/admin/plans';

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to save plan');
        return;
      }

      toast.success(isEdit ? 'Plan updated' : 'Plan created');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">
            {isEdit ? 'Edit Plan' : 'Add Plan'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Plan Name */}
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Plan Name</Label>
            <Select
              value={form.watch('name')}
              onValueChange={(val) =>
                form.setValue('name', val as PlanFormValues['name'], { shouldValidate: true })
              }
              disabled={isEdit}
            >
              <SelectTrigger id="plan-name">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STARTER">Starter</SelectItem>
                <SelectItem value="GROWTH">Growth</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="monthly-price">Monthly Price (LKR)</Label>
              <Input
                id="monthly-price"
                type="number"
                step="0.01"
                min="0"
                {...form.register('monthlyPrice', { valueAsNumber: true })}
              />
              {form.formState.errors.monthlyPrice && (
                <p className="text-xs text-red-600">{form.formState.errors.monthlyPrice.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="annual-price">Annual Price (LKR)</Label>
              <Input
                id="annual-price"
                type="number"
                step="0.01"
                min="0"
                {...form.register('annualPrice', { valueAsNumber: true })}
              />
              {form.formState.errors.annualPrice && (
                <p className="text-xs text-red-600">{form.formState.errors.annualPrice.message}</p>
              )}
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="max-users">Max Users</Label>
              <Input
                id="max-users"
                type="number"
                min="1"
                step="1"
                {...form.register('maxUsers', { valueAsNumber: true })}
              />
              {form.formState.errors.maxUsers && (
                <p className="text-xs text-red-600">{form.formState.errors.maxUsers.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-variants">Max Variants</Label>
              <Input
                id="max-variants"
                type="number"
                min="1"
                step="1"
                {...form.register('maxProductVariants', { valueAsNumber: true })}
              />
              {form.formState.errors.maxProductVariants && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.maxProductVariants.message}
                </p>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Features</Label>
            <div className="flex flex-wrap gap-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-1">
                  <Input
                    className="h-8 w-48"
                    placeholder="Feature name"
                    {...form.register(`features.${index}.value`)}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500"
                      onClick={() => remove(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ value: '' })}
            >
              + Add Feature
            </Button>
            {form.formState.errors.features && !Array.isArray(form.formState.errors.features) && (
              <p className="text-xs text-red-600">{form.formState.errors.features.message}</p>
            )}
          </div>

          {/* Active Switch (edit only) */}
          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch
                id="is-active"
                checked={form.watch('isActive')}
                onCheckedChange={(checked) =>
                  form.setValue('isActive', checked, { shouldValidate: true })
                }
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Update Plan' : 'Create Plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
