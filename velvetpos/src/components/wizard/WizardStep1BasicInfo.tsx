'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { useProductWizardStore } from '@/stores/productWizardStore';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import {
  GENDER_OPTIONS,
  TAX_RULE,
  TAX_RULE_OPTIONS,
} from '@/lib/constants/product-options';
import {
  productStep1Schema,
  type ProductStep1FormData,
} from '@/lib/validators/product-wizard.validators';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TagInput } from '@/components/product/TagInput';

export function WizardStep1BasicInfo() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { step1Data, setStep1Data, goToStep, resetWizard } =
    useProductWizardStore();

  const { data: categoriesRes, isLoading: categoriesLoading } = useCategories();
  const { data: brandsRes, isLoading: brandsLoading } = useBrands();

  const categories = categoriesRes?.data ?? [];
  const brands = brandsRes?.data ?? [];

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryCreating, setCategoryCreating] = useState(false);

  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [brandCreating, setBrandCreating] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductStep1FormData>({
    resolver: standardSchemaResolver(productStep1Schema),
    defaultValues: step1Data
      ? {
          name: step1Data.name,
          description: step1Data.description,
          categoryId: step1Data.categoryId,
          brandId: step1Data.brandId,
          gender: step1Data.gender,
          tags: step1Data.tags,
          taxRule: step1Data.taxRule,
        }
      : {
          name: '',
          description: '',
          categoryId: '',
          brandId: '',
          gender: '' as ProductStep1FormData['gender'],
          tags: [],
          taxRule: TAX_RULE.STANDARD_VAT,
        },
  });

  const watchedDescription = watch('description') ?? '';

  const onSubmit = (data: ProductStep1FormData) => {
    setStep1Data({
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      brandId: data.brandId,
      gender: data.gender,
      tags: data.tags,
      taxRule: data.taxRule,
    });
    goToStep(2);
  };

  const handleCancel = () => {
    resetWizard();
    router.push('/inventory');
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCategoryCreating(true);
    try {
      const res = await fetch('/api/store/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error('Failed to create category');
      const json = await res.json();
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (json.data?.id) {
        setValue('categoryId', json.data.id, { shouldValidate: true });
      }
      setNewCategoryName('');
      setCategoryDialogOpen(false);
    } catch {
      // silently fail — user can retry
    } finally {
      setCategoryCreating(false);
    }
  };

  const handleCreateBrand = async () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) return;
    setBrandCreating(true);
    try {
      const res = await fetch('/api/store/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error('Failed to create brand');
      const json = await res.json();
      await queryClient.invalidateQueries({ queryKey: ['brands'] });
      if (json.data?.id) {
        setValue('brandId', json.data.id, { shouldValidate: true });
      }
      setNewBrandName('');
      setBrandDialogOpen(false);
    } catch {
      // silently fail — user can retry
    } finally {
      setBrandCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="font-display text-2xl text-espresso">Basic Information</h2>

      {/* Product Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="font-body text-espresso">
          Product Name
        </Label>
        <Input
          id="name"
          placeholder="e.g. Classic Oxford Shirt"
          className="font-body"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="font-body text-espresso">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Describe the product..."
          className="font-body min-h-[100px]"
          {...register('description')}
        />
        <p className="text-xs text-mist text-right">
          {watchedDescription.length}/1000
        </p>
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label className="font-body text-espresso">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={categoriesLoading}
            >
              <SelectTrigger className="w-full font-body">
                <SelectValue
                  placeholder={
                    categoriesLoading ? 'Loading…' : 'Select a category'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.categoryId && (
          <p className="text-sm text-red-600">{errors.categoryId.message}</p>
        )}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-terracotta hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Create new category
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="font-display text-espresso">
                New Category
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="font-body"
              />
              <Button
                type="button"
                onClick={handleCreateCategory}
                disabled={categoryCreating || !newCategoryName.trim()}
                className="w-full bg-espresso text-pearl hover:bg-espresso/90"
              >
                {categoryCreating ? 'Creating…' : 'Save Category'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Brand */}
      <div className="space-y-2">
        <Label className="font-body text-espresso">Brand (optional)</Label>
        <Controller
          control={control}
          name="brandId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={brandsLoading}
            >
              <SelectTrigger className="w-full font-body">
                <SelectValue
                  placeholder={
                    brandsLoading ? 'Loading…' : 'Select a brand'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.brandId && (
          <p className="text-sm text-red-600">{errors.brandId.message}</p>
        )}
        <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-terracotta hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Create new brand
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="font-display text-espresso">
                New Brand
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Brand name"
                className="font-body"
              />
              <Button
                type="button"
                onClick={handleCreateBrand}
                disabled={brandCreating || !newBrandName.trim()}
                className="w-full bg-espresso text-pearl hover:bg-espresso/90"
              >
                {brandCreating ? 'Creating…' : 'Save Brand'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <Label className="font-body text-espresso">Gender</Label>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => field.onChange(opt.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    field.value === opt.value
                      ? 'bg-espresso text-pearl'
                      : 'border border-mist text-espresso hover:bg-mist/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        />
        {errors.gender && (
          <p className="text-sm text-red-600">{errors.gender.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label className="font-body text-espresso">Tags</Label>
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <TagInput value={field.value ?? []} onChange={field.onChange} />
          )}
        />
        {errors.tags && (
          <p className="text-sm text-red-600">{errors.tags.message}</p>
        )}
      </div>

      {/* Tax Rule */}
      <div className="space-y-2">
        <Label className="font-body text-espresso">Tax Rule</Label>
        <Controller
          control={control}
          name="taxRule"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full font-body">
                <SelectValue placeholder="Select tax rule" />
              </SelectTrigger>
              <SelectContent>
                {TAX_RULE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.taxRule && (
          <p className="text-sm text-red-600">{errors.taxRule.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          className="border-mist text-espresso hover:bg-mist/20"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-espresso text-pearl hover:bg-espresso/90"
        >
          Next: Add Variants →
        </Button>
      </div>
    </form>
  );
}
