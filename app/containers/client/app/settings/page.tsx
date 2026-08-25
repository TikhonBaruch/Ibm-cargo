import { redirect } from "next/navigation";

/** Settings merged into profile (D17 extract). */
export default function Page() {
  const base = (process.env.NEXT_PUBLIC_CLIENT_BASE || "").replace(/\/$/, "");
  redirect(base ? `${base}/profile` : "/profile");
}
