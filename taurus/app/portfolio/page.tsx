import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PortfolioGrid } from "@/components/PortfolioGrid";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", isFeatured: true },
    select: {
      id: true,
      title: true,
      slug: true,
      coverImage: true,
      excerpt: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="text-slate-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="mb-2 text-2xl font-bold">Портфолио</h1>
        <p className="mb-8 text-sm text-slate-400">
          Избранные работы и проекты
        </p>
        <PortfolioGrid items={posts} />
      </main>
      <Footer />
    </div>
  );
}
