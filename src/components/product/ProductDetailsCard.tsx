'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImageViewerModal } from '@/components/product/ImageViewerModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  UNISEX: 'Unisex',
  KIDS: 'Kids',
  TODDLERS: 'Toddlers',
};

const TAX_LABELS: Record<string, string> = {
  STANDARD_VAT: 'Standard VAT (15%)',
  SSCL: 'SSCL',
  EXEMPT: 'VAT Exempt',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductDetailsCardProps {
  product: {
    name: string;
    description: string | null;
    gender: string;
    tags: string[];
    taxRule: string;
    category: { id: string; name: string } | null;
    brand: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  variants?: { imageUrls: string[] }[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProductDetailsCard({ product, variants = [] }: ProductDetailsCardProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const descTruncated = product.description && product.description.length > 200;

  // Primary image = imageUrls[0] of the first variant that has images
  const primaryImage = variants.flatMap((v) => v.imageUrls).find(Boolean) ?? null;

  return (
    <div className="space-y-5">
      {/* Primary image */}
      {primaryImage && (
        <div className="flex justify-center">
          <button
            type="button"
            className="group relative overflow-hidden rounded-xl border border-sand/30 bg-linen shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
            onClick={() => setViewerOpen(true)}
            aria-label="View primary product image"
          >
            <Image
              src={primaryImage}
              alt={product.name}
              width={320}
              height={320}
              className="block h-64 w-64 object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
            <div className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="rounded-full bg-espresso/70 px-3 py-1 text-xs font-body text-pearl">
                View image
              </span>
            </div>
          </button>
          <ImageViewerModal
            open={viewerOpen}
            onClose={() => setViewerOpen(false)}
            images={[primaryImage]}
            currentIndex={0}
            onIndexChange={() => {}}
          />
        </div>
      )}

    <div className="rounded-lg border border-sand/30 bg-pearl p-6">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        {/* Name */}
        <FieldRow label="Name" value={product.name} />

        {/* Description */}
        <div className="sm:col-span-2">
          <dt className="font-body text-xs font-semibold uppercase tracking-wider text-mist">
            Description
          </dt>
          <dd className="mt-1 font-body text-sm text-espresso whitespace-pre-wrap">
            {!product.description ? (
              <span className="text-mist italic">No description</span>
            ) : descTruncated && !descExpanded ? (
              <>
                {product.description.slice(0, 200)}…{' '}
                <button
                  type="button"
                  className="text-terracotta hover:underline text-xs font-medium"
                  onClick={() => setDescExpanded(true)}
                >
                  Show more
                </button>
              </>
            ) : (
              <>
                {product.description}
                {descTruncated && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="text-terracotta hover:underline text-xs font-medium"
                      onClick={() => setDescExpanded(false)}
                    >
                      Show less
                    </button>
                  </>
                )}
              </>
            )}
          </dd>
        </div>

        {/* Gender */}
        <FieldRow
          label="Gender"
          value={GENDER_LABELS[product.gender] ?? product.gender}
        />

        {/* Tax Rule */}
        <FieldRow
          label="Tax Rule"
          value={TAX_LABELS[product.taxRule] ?? product.taxRule}
        />

        {/* Category */}
        <div>
          <dt className="font-body text-xs font-semibold uppercase tracking-wider text-mist">
            Category
          </dt>
          <dd className="mt-1 font-body text-sm text-espresso">
            {product.category ? (
              <Link
                href="/inventory"
                className="text-terracotta hover:underline"
              >
                {product.category.name}
              </Link>
            ) : (
              <span className="text-mist italic">Uncategorized</span>
            )}
          </dd>
        </div>

        {/* Brand */}
        <div>
          <dt className="font-body text-xs font-semibold uppercase tracking-wider text-mist">
            Brand
          </dt>
          <dd className="mt-1 font-body text-sm text-espresso">
            {product.brand ? (
              <Link
                href="/inventory"
                className="text-terracotta hover:underline"
              >
                {product.brand.name}
              </Link>
            ) : (
              <span className="text-mist italic">No brand</span>
            )}
          </dd>
        </div>

        {/* Tags */}
        <div className="sm:col-span-2">
          <dt className="font-body text-xs font-semibold uppercase tracking-wider text-mist">
            Tags
          </dt>
          <dd className="mt-1.5 flex flex-wrap gap-2">
            {product.tags.length === 0 ? (
              <span className="font-body text-sm text-mist italic">No tags</span>
            ) : (
              product.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-sand/30 px-2.5 py-0.5 text-xs font-medium text-espresso"
                >
                  {tag}
                </span>
              ))
            )}
          </dd>
        </div>

        {/* Created At */}
        <FieldRow label="Created At" value={formatDate(product.createdAt)} />

        {/* Last Modified */}
        <FieldRow label="Last Modified" value={formatDate(product.updatedAt)} />
      </dl>
    </div>
    </div>
  );
}

// ── Simple field row ─────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body text-xs font-semibold uppercase tracking-wider text-mist">
        {label}
      </dt>
      <dd className="mt-1 font-body text-sm text-espresso">{value}</dd>
    </div>
  );
}
