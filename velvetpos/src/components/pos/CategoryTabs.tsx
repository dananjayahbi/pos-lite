'use client';

interface CategoryTabsProps {
  categories: Array<{ id: string; name: string }>;
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}

export function CategoryTabs({
  categories,
  selectedCategoryId,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div
      className="flex gap-2 px-4 py-3 overflow-x-auto whitespace-nowrap"
      style={{ scrollbarWidth: 'none' }}
    >
      <button
        type="button"
        onClick={() => onCategoryChange(null)}
        className={`shrink-0 rounded-full px-4 py-2 font-body text-[13px] transition-colors duration-150 ease-in-out ${
          selectedCategoryId === null
            ? 'bg-sand text-espresso border-b-2 border-sand'
            : 'bg-transparent text-terracotta hover:bg-sand/50'
        }`}
      >
        All Products
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onCategoryChange(cat.id)}
          className={`shrink-0 rounded-full px-4 py-2 font-body text-[13px] transition-colors duration-150 ease-in-out ${
            selectedCategoryId === cat.id
              ? 'bg-sand text-espresso border-b-2 border-sand'
              : 'bg-transparent text-terracotta hover:bg-sand/50'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
