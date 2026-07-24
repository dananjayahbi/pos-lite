/**
 * Loading skeleton shown while the storefront's server component is
 * fetching website config / products from the ERP backend.
 */
export default function StorefrontLoading() {
  return (
    <div className="site-wrapper">
      <div className="site-header">
        <div className="site-header-inner">
          <div className="h-8 w-32 bg-black/10 rounded animate-pulse" />
        </div>
      </div>
      <div
        className="w-full bg-black/5 animate-pulse"
        style={{ aspectRatio: '16 / 9', maxHeight: '85vh' }}
      />
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="h-8 w-48 mx-auto bg-black/10 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square bg-black/5 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}