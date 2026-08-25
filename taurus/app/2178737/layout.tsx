/** Public obscure login stays outside the gated `(cms)` group. */
export default function SuperAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
