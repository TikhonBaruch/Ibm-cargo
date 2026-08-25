import { redirect } from "next/navigation";
import { SUPER_ADMIN_BASE } from "@/lib/ved/super-admin";

export default function RedirectLegacyCms() {
  redirect(`${SUPER_ADMIN_BASE}/gallery`);
}
