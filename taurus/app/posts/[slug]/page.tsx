import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Tag } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { CommentsSection } from "@/components/CommentsSection";
import { SITE_URL } from "@/lib/config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const typeLabels: Record<string, string> = {
  NEWS: "Новость",
  WORK: "Работа",
  UPDATE: "Обновление",
  EVENT: "Событие",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, excerpt: true, coverImage: true, metaTitle: true, metaDescription: true, ogImage: true },
  });

  if (!post) return { title: "Публикация не найдена" };

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || post.title;
  const image = post.ogImage || post.coverImage;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/posts/${slug}`,
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : [],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : [],
    },
    alternates: {
      canonical: `${SITE_URL}/posts/${slug}`,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      author: { select: { name: true } },
      tags: { select: { name: true, slug: true } },
      media: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!post) notFound();

  const seoTitle = post.metaTitle || post.title;
  const seoDesc = post.metaDescription || post.excerpt || post.content?.slice(0, 160) || "";
  const seoImage = post.ogImage || post.coverImage;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seoTitle,
    description: seoDesc,
    image: seoImage,
    url: `${SITE_URL}/posts/${post.slug}`,
    datePublished: (post.publishedAt || post.createdAt).toISOString(),
    author: { "@type": "Person", name: post.author?.name || "Ядро" },
    publisher: {
      "@type": "Organization",
      name: "Ядро",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/images/hero.jpg` },
    },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Публикации", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 3, name: seoTitle, item: `${SITE_URL}/posts/${post.slug}` },
    ],
  };

  return (
    <div className="text-slate-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-12">
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Назад к публикациям
        </Link>
        {/* Cover image */}
        {post.coverImage && (
          <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-xl">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        {/* Meta */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
            {typeLabels[post.type] || post.type}
          </span>
          {post.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {post.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {(post.publishedAt || post.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          {post.author.name && (
            <span className="text-slate-500">{post.author.name}</span>
          )}
        </div>

        {/* Title */}
        <h1 className="mb-6 text-3xl font-bold leading-tight">{post.title}</h1>

        {/* Content */}
        {post.content && (
          <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">
            {post.content}
          </div>
        )}

        {/* Media gallery */}
        {post.media.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {post.media.map((m) => (
              <div
                key={m.id}
                className="relative aspect-square overflow-hidden rounded-lg"
              >
                <Image
                  src={m.url}
                  alt={m.filename || ""}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 384px"
                />
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Tag className="h-4 w-4 text-slate-500" />
            {post.tags.map((tag) => (
              <span
                key={tag.slug}
                className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Share */}
        <div className="mt-8 border-t border-slate-800 pt-6">
          <ShareButtons
            url={`${SITE_URL}/posts/${post.slug}`}
            title={post.title}
            description={post.content?.slice(0, 200) || post.title}
          />
        </div>

        {/* Comments temporarily disabled */}
        {/* <CommentsSection postSlug={post.slug} /> */}
      </main>

      <Footer />
    </div>
  );
}
