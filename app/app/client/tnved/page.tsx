import { ClientTnved } from "@/lbm-bro/components/client-tnved";
import { TnvedLabBanner } from "./tnved-banner";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const hs = typeof q.hs === "string" ? q.hs : "";
  return (
    <>
      <TnvedLabBanner />
      <ClientTnved key={hs} initialQuery={hs} />
    </>
  );
}
