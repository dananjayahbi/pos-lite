'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, Loader2, Package } from 'lucide-react';
import { useProductWizardStore } from '@/stores/productWizardStore';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import { Button } from '@/components/ui/button';
import { formatRupee } from '@/lib/format';
import { getPendingImages, clearPendingFiles } from '@/lib/wizardPendingFiles';

export function WizardStep3Review() {
  const router = useRouter();
  const { step1Data, step2Data, goToStep, resetWizard } = useProductWizardStore();

  const { data: categoriesRes } = useCategories();
  const { data: brandsRes } = useBrands();

  const categories = categoriesRes?.data ?? [];
  const brands = brandsRes?.data ?? [];

  const categoryName = categories.find((c) => c.id === step1Data?.categoryId)?.name ?? step1Data?.categoryId ?? '—';
  const brandName = step1Data?.brandId
    ? (brands.find((b) => b.id === step1Data.brandId)?.name ?? step1Data.brandId)
    : '—';

  const { mutate: createProduct, isPending } = useMutation({
    mutationFn: async () => {
      if (!step1Data || !step2Data) throw new Error('Wizard data is incomplete');

      // Upload pending files for each variant
      const variantImageUrls: Record<string, { urls: string[]; primaryIndex: number }> = {};
      for (const v of step2Data.variants) {
        const key = `${v.size ?? ''}|${v.colour ?? ''}`;
        const pending = getPendingImages(key);
        const uploadedUrls: string[] = [];
        for (const entry of pending.pending) {
          const formData = new FormData();
          formData.append('image', entry.file);
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          if (res.ok) {
            const data = (await res.json()) as { url: string };
            uploadedUrls.push(data.url);
          }
        }
        variantImageUrls[key] = { urls: uploadedUrls, primaryIndex: pending.primaryIndex };
      }

      const body = {
        name: step1Data.name,
        description: step1Data.description || undefined,
        categoryId: step1Data.categoryId,
        brandId: step1Data.brandId || undefined,
        gender: step1Data.gender,
        tags: step1Data.tags,
        taxRule: step1Data.taxRule,
        variantDefinitions: step2Data.variants.map((v) => {
          const key = `${v.size ?? ''}|${v.colour ?? ''}`;
          const imgData = variantImageUrls[key];
          const urls = imgData?.urls ?? v.imageUrls ?? [];
          const pIdx = imgData?.primaryIndex ?? 0;
          // Reorder so primary comes first
          const reordered = urls.length > 0 && pIdx > 0
            ? [urls[pIdx], ...urls.filter((_, i) => i !== pIdx)]
            : urls;
          return { ...v, imageUrls: reordered };
        }),
      };

      const res = await fetch('/api/store/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to create product');
      clearPendingFiles();
      return json;
    },
    onSuccess: () => {
      toast.success('Product created successfully');
      resetWizard();
      router.push('/inventory');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create product');
    },
  });

  if (!step1Data || !step2Data) {
    return (
      <div className="py-12 text-center text-sand">
        <p>Wizard data is missing. Please start over.</p>
        <Button variant="outline" className="mt-4" onClick={() => goToStep(1)}>
          Start Over
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-espresso">Review &amp; Create</h2>
        <p className="mt-1 text-sm text-sand">Check the details below before saving the product.</p>
      </div>

      {/* Product details */}
      <section className="rounded-xl border border-mist bg-white">
        <div className="border-b border-mist px-4 py-2.5">
          <h3 className="text-sm font-semibold text-espresso">Product Details</h3>
        </div>
        <dl className="divide-y divide-mist/50 text-sm">
          <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
            <dt className="text-sand">Name</dt>
            <dd className="col-span-2 font-medium text-espresso">{step1Data.name}</dd>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
            <dt className="text-sand">Category</dt>
            <dd className="col-span-2 text-espresso">{categoryName}</dd>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
            <dt className="text-sand">Brand</dt>
            <dd className="col-span-2 text-espresso">{brandName}</dd>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
            <dt className="text-sand">Gender</dt>
            <dd className="col-span-2 text-espresso capitalize">{step1Data.gender.replace(/_/g, ' ').toLowerCase()}</dd>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
            <dt className="text-sand">Tax Rule</dt>
            <dd className="col-span-2 text-espresso">{step1Data.taxRule.replace(/_/g, ' ')}</dd>
          </div>
          {step1Data.tags.length > 0 && (
            <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
              <dt className="text-sand">Tags</dt>
              <dd className="col-span-2 flex flex-wrap gap-1">
                {step1Data.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-linen px-2 py-0.5 text-xs text-espresso"
                  >
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {step1Data.description && (
            <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
              <dt className="text-sand">Description</dt>
              <dd className="col-span-2 text-sm text-espresso/80">{step1Data.description}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Variants */}
      <section className="rounded-xl border border-mist bg-white">
        <div className="border-b border-mist px-4 py-2.5 flex items-center gap-2">
          <Package className="h-4 w-4 text-sand" />
          <h3 className="text-sm font-semibold text-espresso">
            {step2Data.variants.length} Variant{step2Data.variants.length !== 1 ? 's' : ''}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist/50 text-left">
                <th className="px-4 py-2 font-medium text-sand">Size</th>
                <th className="px-4 py-2 font-medium text-sand">Colour</th>
                <th className="px-4 py-2 font-medium text-sand">SKU</th>
                <th className="px-4 py-2 font-medium text-sand">Barcode</th>
                <th className="px-4 py-2 text-right font-medium text-sand">Stock</th>
                <th className="px-4 py-2 text-right font-medium text-sand">Cost</th>
                <th className="px-4 py-2 text-right font-medium text-sand">Retail</th>
                <th className="px-4 py-2 text-right font-medium text-sand">Low Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/30">
              {step2Data.variants.map((v, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-espresso">{v.size ?? '—'}</td>
                  <td className="px-4 py-2">
                    {v.colour ? (
                      <span className="inline-flex items-center gap-1.5 text-espresso">
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-espresso/20 shrink-0"
                          style={{ backgroundColor: v.colour }}
                        />
                        {v.colour}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-sand">{v.sku ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-sand">{v.barcode ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-espresso">{v.initialStock ?? 0}</td>
                  <td className="px-4 py-2 text-right font-mono text-espresso">
                    {formatRupee(v.costPrice)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-espresso">
                    {formatRupee(v.retailPrice)}
                  </td>
                  <td className="px-4 py-2 text-right text-sand">{v.lowStockThreshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => goToStep(2)}
          disabled={isPending}
          className="text-sand hover:text-espresso"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => createProduct()}
          disabled={isPending}
          className="bg-espresso text-pearl hover:bg-espresso/90"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Product
        </Button>
      </div>
    </div>
  );
}
