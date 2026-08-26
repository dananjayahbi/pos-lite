'use client';

import type { PublicProduct } from '@/types/website.types';

interface ProductHealthSectionsProps {
  product: PublicProduct;
}

interface Section {
  key: string;
  title: string;
  content: string;
}

/** A reusable, styled renderer for the four Ayurvedic health-content sections. */
export function ProductHealthSections({ product }: ProductHealthSectionsProps) {
  const sections: Section[] = [
    { key: 'ingredients', title: 'Active Ingredients', content: product.activeIngredients ?? '' },
    { key: 'usage', title: 'How to Use', content: product.usageInstructions ?? '' },
    { key: 'benefits', title: 'Benefits', content: product.healthBenefits ?? '' },
    { key: 'precautions', title: 'Precautions', content: product.safetyPrecautions ?? '' },
  ].filter((s) => s.content.trim().length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="mt-8 border-t border-gray-100 pt-6 space-y-6">
      {sections.map((section) => (
        <div key={section.key}>
          <h3 className="text-base font-semibold uppercase tracking-wide text-gray-900">
            {section.title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
}
