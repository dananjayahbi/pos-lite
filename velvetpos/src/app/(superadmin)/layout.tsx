// Shell placeholder — the full SuperAdmin sidebar layout is implemented in Phase 03.
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-espresso">
      {children}
    </div>
  );
}
