/**
 * Loading skeleton for the category listing page.
 */
export default function CategoryLoading() {
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
        </div>

        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-9 w-48 bg-gray-100 rounded animate-pulse mb-3" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-gray-100 rounded" />
              <div className="p-3 text-center">
                <div className="h-4 w-3/4 mx-auto bg-gray-100 rounded mb-2" />
                <div className="h-4 w-1/3 mx-auto bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
