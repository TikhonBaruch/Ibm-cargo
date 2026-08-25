import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/config";
import { SpecialistCard } from "@/components/SpecialistCard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Команда | LBM Брокер",
    description: "Наши специалисты — профессионалы в своей области.",
    openGraph: {
      title: "Команда | LBM Брокер",
      description: "Наши специалисты — профессионалы в своей области.",
      url: `${SITE_URL}/specialists`,
    },
    alternates: { canonical: `${SITE_URL}/specialists` },
  };
}

export default async function SpecialistsPage() {
  const specialists = await prisma.user.findMany({
    where: { showInTeam: true },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      specialization: true,
      experience: true,
      sortOrder: true,
      _count: { select: { posts: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="text-slate-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-2 text-[10px] tracking-[0.2em] text-slate-500 uppercase">Команда</div>
        <h1 className="mb-2 text-3xl font-bold text-slate-100">Наши специалисты</h1>
        <p className="mb-8 text-sm text-slate-400">
          Профессионалы в своей области
        </p>

        {specialists.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <p className="text-slate-400">Информация о специалистах скоро появится</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {specialists.map((specialist) => (
              <SpecialistCard key={specialist.id} specialist={specialist} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
