import { redirect } from "next/navigation";

/** Settings merged into profile — keep route for bookmarks. */
export default function Page() {
  redirect("/cabinet/profile");
}
