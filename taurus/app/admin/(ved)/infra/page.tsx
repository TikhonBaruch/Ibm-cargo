import { redirect } from "next/navigation";
import { SUPER_ADMIN_BASE } from "@/lib/ved/super-admin";

/** Legacy path → obscure SUPER CMS. */
export default function AdminInfraRedirect() {
  redirect(`${SUPER_ADMIN_BASE}/infra`);
}
