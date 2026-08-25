import { requirePathAccess } from "@/lib/ved/require-path-access";
import SuperAdminChrome from "../SuperAdminChrome";

export default async function SuperAdminCmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/2178737");
  return <SuperAdminChrome>{children}</SuperAdminChrome>;
}
