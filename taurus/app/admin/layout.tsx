/** Public `/admin/login` stays outside the gated `(ved)` group. */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
