import { requirePathAccess } from "@/lib/ved/require-path-access";

export default async function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/cabinet");
  return <>{children}</>;
}
