'use client';

import { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { CategoryTree } from '@/components/categories/CategoryTree';
import { InlineCategoryForm } from '@/components/categories/InlineCategoryForm';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CategoriesPageClientProps {
  permissions: string[];
}

export function CategoriesPageClient({ permissions }: CategoriesPageClientProps) {
  const { data } = useCategories();
  const [showForm, setShowForm] = useState(false);

  const categories = data?.data ?? [];
  const canEdit = permissions.includes('product:edit');
  const canDelete = permissions.includes('product:delete');

  return (
    <div className="flex gap-6 p-6">
      {/* Left panel */}
      <div className="w-3/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-espresso">Categories</h1>
            <p className="text-sm text-mist">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-espresso text-pearl hover:bg-espresso/90"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Category
          </Button>
        </div>

        {showForm && (
          <InlineCategoryForm
            categories={categories}
            onClose={() => setShowForm(false)}
          />
        )}

        <CategoryTree
          categories={categories}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      {/* Right panel */}
      <div className="flex w-2/5 items-center justify-center rounded-lg border border-sand bg-linen p-8">
        <p className="text-sm text-mist">Select a category to see details</p>
      </div>
    </div>
  );
}
