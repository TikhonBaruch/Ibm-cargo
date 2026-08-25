import { redirect } from "next/navigation";
import { SUPER_ADMIN_BASE } from "@/lib/ved/super-admin";

/** Legacy /admin CMS → obscure SUPER_ADMIN surface */
export default function RedirectLegacyCms() {
  redirect(`${SUPER_ADMIN_BASE}/chat`);
}
