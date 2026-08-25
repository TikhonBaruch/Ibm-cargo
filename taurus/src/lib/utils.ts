import { prisma } from "./prisma";

/**
 * Generate a unique slug from title
 */
export async function generateSlug(title: string): Promise<string> {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "");

  let counter = 0;
  let candidateSlug = slug;

  while (await prisma.post.findUnique({ where: { slug: candidateSlug } })) {
    counter++;
    candidateSlug = `${slug}-${counter}`;
  }

  return candidateSlug;
}

/**
 * Extract S3 key from URL
 * URL format: https://endpoint/bucket/key → key
 */
export function extractS3Key(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname.slice(1).replace(/^[^\/]+\//, "");
}

/**
 * Upsert tags from array of tag names (batch operation)
 */
export async function upsertTags(tagNames: string[]): Promise<{ id: string }[]> {
  if (tagNames.length === 0) return [];

  const tagData = tagNames.map((name) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-"),
  }));

  // Use transaction for batch upsert
  const results = await prisma.$transaction(
    tagData.map((tag) =>
      prisma.tag.upsert({
        where: { slug: tag.slug },
        update: {},
        create: tag,
      })
    )
  );

  return results.map((tag) => ({ id: tag.id }));
}
