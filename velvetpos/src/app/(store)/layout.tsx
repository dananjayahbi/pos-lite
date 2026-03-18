// Shell placeholder — the AppSidebar and main content area will be integrated
// in SubPhase 02.xx when the navigation components are built.
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-linen">
      {children}
    </div>
  );
}
