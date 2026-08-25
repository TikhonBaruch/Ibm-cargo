import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/config";
import { SpecialistProfile } from "@/components/SpecialistProfile";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Calendar } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const specialist = await prisma.user.findUnique({
    where: { id },
    select: { name: true, bio: true, specialization: true },
  });

  if (!specialist) return { title: "Специалист не найден" };

  return {
    title: `${specialist.name || "Специалист"} | Команда`,
    description: specialist.bio?.slice(0, 160) || `${specialist.specialization || "Специалист"}`,
    openGraph: {
      title: `${specialist.name || "Специалист"} | Команда`,
      description: specialist.bio?.slice(0, 160) || "",
    },
    alternates: { canonical: `${SITE_URL}/specialists/${id}` },
  };
}

const typeLabels: Record<string, string> = {
  NEWS: "Новость",
  WORK: "Работа",
  UPDATE: "Обновление",
  EVENT: "Событие",
  PROMO: "Акция",
};

export default async function SpecialistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const specialist = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      specialization: true,
      phone: true,
      experience: true,
      showInTeam: true,
      _count: { select: { posts: true } },
    },
  });

  if (!specialist || !specialist.showInTeam) notFound();

  const posts = await prisma.post.findMany({
    where: { authorId: id, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      type: true,
      createdAt: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 12,
  });

  return (
    <div className="text-slate-100">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link
          href="/specialists"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Назад к команде
        </Link>

        <SpecialistProfile
          name={specialist.name}
          image={specialist.image}
          bio={specialist.bio}
          specialization={specialist.specialization}
          phone={specialist.phone}
          experience={specialist.experience}
          postCount={specialist._count.posts}
        />

        {posts.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 text-lg font-semibold text-slate-100">Публикации</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.slug}`}
                  className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition hover:border-slate-700"
                >
                  {post.coverImage && (
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image src={post.coverImage} alt={post.title} fill className="object-cover transition group-hover:scale-105" sizes="(max-width: 640px) 100vw, 50vw" />
                    </div>
                  )}
                  <div className="p-3">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{typeLabels[post.type] || post.type}</span>
                    <h3 className="mt-2 text-sm font-semibold text-slate-100 line-clamp-2">{post.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
