import { requirePathAccess } from "@/lib/ved/require-path-access";

export default async function BrokerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/broker");
  return <>{children}</>;
}
