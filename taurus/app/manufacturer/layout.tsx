import { requirePathAccess } from "@/lib/ved/require-path-access";

export default async function ManufacturerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/manufacturer");
  return <>{children}</>;
}
