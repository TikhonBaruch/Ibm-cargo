import { requirePathAccess } from "@/lib/ved/require-path-access";
import AdminChrome from "../AdminChrome";

export default async function AdminVedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/admin");
  return <AdminChrome>{children}</AdminChrome>;
}
