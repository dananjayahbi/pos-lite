/**
 * Loading skeleton for the product detail page.
 */
export default function ProductLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header skeleton */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb skeleton */}
        <div className="mb-6 flex gap-2">
          <div className="h-4 w-12 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-1 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-1 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Product layout skeleton */}
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
          <div className="flex flex-col gap-4">
            <div className="h-8 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-6 w-1/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-20 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-12 w-48 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}
