import React from 'react';
import type { PublicCategory } from '@/types/website.types';

interface CategoryHeaderProps {
  category: PublicCategory;
}

/**
 * Category title, description, and product count.
 */
export function CategoryHeader({ category }: CategoryHeaderProps) {
  return (
    <div className="mb-8">
      <h1
        className="text-3xl md:text-4xl font-medium"
        style={{ fontFamily: 'var(--font-dm-serif), serif' }}
      >
        {category.name}
      </h1>
      {category.description && (
        <p className="mt-2 max-w-2xl text-gray-600">{category.description}</p>
      )}
      {category.productCount != null && (
        <p className="mt-1 text-sm text-gray-500">
          {category.productCount} product{category.productCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
