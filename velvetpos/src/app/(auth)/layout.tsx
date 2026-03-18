export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linen flex items-center justify-center">
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
