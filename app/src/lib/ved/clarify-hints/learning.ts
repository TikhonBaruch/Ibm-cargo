/**
 * Clarify-hints P2 learning: hs_feedback write-back, option weights, product profiles.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { detectCategory } from "./detect";
import { normalizeHsCode } from "../tnved";
import type { ProductAttrs } from "../product-description";
import type { CategoryId, ClarifyOption } from "./types";

type Db = Pick<
  PrismaClient,
  "clarifyHsFeedback" | "clarifyProductProfile" | "clarifyAttributeOption" | "clarifyDependencyEdge"
>;

function fingerprintText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

/** Extract clarify answer tokens from description «Уточнения (ИИ)» block or attrs.extra. */
export function extractClarifyAnswersFromText(desc: string): Record<string, string> {
  const answers: Record<string, string> = {};
  const matches = [...desc.matchAll(/Ответ:\s*(.+)/g)];
  matches.forEach((m, i) => {
    const v = m[1]?.trim();
    if (v) answers[`a${i}`] = v;
  });
  return answers;
}

export async function recordClarifyFeedbackFromApprove(
  db: Db,
  opts: {
    calculationId: string;
    approvedByUserId: string;
    title: string;
    description?: string | null;
    items: Array<{
      itemId: string;
      name: string;
      description?: string | null;
      attrs?: ProductAttrs | null;
      hsCodeFinal: string;
    }>;
  }
): Promise<void> {
  for (const item of opts.items) {
    const hsDigits = normalizeHsCode(item.hsCodeFinal);
    if (!hsDigits || hsDigits.length < 4) continue;

    const blob = [opts.title, opts.description, item.name, item.description]
      .filter(Boolean)
      .join("\n");
    const category = detectCategory(blob);
    const fromBlock = extractClarifyAnswersFromText(blob);
    const fromExtra = item.attrs?.extra || {};
    const answers: Record<string, string> = { ...fromBlock };
    for (const [k, v] of Object.entries(fromExtra)) {
      if (v?.trim()) answers[k] = v.trim();
    }
    if (item.attrs?.composition?.trim()) answers.composition = item.attrs.composition.trim();
    if (item.attrs?.material?.trim()) answers.material = item.attrs.material.trim();
    if (item.attrs?.purpose?.trim()) answers.purpose = item.attrs.purpose.trim();

    const tokens = Object.values(answers).join(" ");
    const canonical = fingerprintText([item.name, item.description, opts.title, tokens].filter(Boolean).join(" "));

    await db.clarifyHsFeedback.create({
      data: {
        category,
        description: blob.slice(0, 4000),
        answersJson: Object.keys(answers).length ? answers : undefined,
        tokens: tokens || null,
        hsCodeFinal: item.hsCodeFinal,
        hsCodeDigits: hsDigits,
        sourceCalculationId: opts.calculationId,
        sourceItemId: item.itemId,
        approvedByUserId: opts.approvedByUserId,
      },
    });

    const existing = await db.clarifyProductProfile.findFirst({
      where: {
        category,
        canonicalText: { equals: canonical, mode: "insensitive" },
      },
      select: { id: true, usageCount: true },
    });
    if (existing) {
      await db.clarifyProductProfile.update({
        where: { id: existing.id },
        data: {
          usageCount: existing.usageCount + 1,
          hsCodeDigits: hsDigits,
          confidence: Math.min(1, 0.5 + (existing.usageCount + 1) * 0.05),
          attrsSnapshot: (item.attrs || undefined) as Prisma.InputJsonValue | undefined,
          sourceCalculationId: opts.calculationId,
          sourceItemId: item.itemId,
        },
      });
    } else {
      await db.clarifyProductProfile.create({
        data: {
          canonicalText: canonical.slice(0, 2000) || item.name.slice(0, 200),
          category,
          confidence: 0.55,
          hsCodeDigits: hsDigits,
          usageCount: 1,
          attrsSnapshot: (item.attrs || undefined) as Prisma.InputJsonValue | undefined,
          sourceCalculationId: opts.calculationId,
          sourceItemId: item.itemId,
        },
      });
    }

    // Bump pickCount for matching option searchValues (soft online learning before nightly).
    for (const [attrKey, searchValue] of Object.entries(answers)) {
      const row = await db.clarifyAttributeOption.findFirst({
        where: {
          category,
          OR: [{ attrKey }, { attrKey: "*" }],
          searchValue: { equals: searchValue, mode: "insensitive" },
        },
      });
      if (row) {
        await db.clarifyAttributeOption.update({
          where: { id: row.id },
          data: {
            pickCount: { increment: 1 },
            weight: Math.min(10, row.weight + 0.15),
          },
        });
      }
    }
  }
}

/** Reorder choice options by DB weight (desc). Unknown options keep relative order at end. */
export async function applyOptionWeights(
  db: Db,
  category: CategoryId,
  attrKey: string,
  options: ClarifyOption[]
): Promise<ClarifyOption[]> {
  if (!options.length) return options;
  const rows = await db.clarifyAttributeOption.findMany({
    where: {
      OR: [
        { category, attrKey },
        { category: "*", attrKey },
      ],
    },
    select: { optionId: true, weight: true },
  });
  if (!rows.length) return options;
  const w = new Map(rows.map((r) => [r.optionId, r.weight]));
  return [...options].sort((a, b) => (w.get(b.id) ?? 1) - (w.get(a.id) ?? 1));
}

/** Reorder questions by dependency edge weight (higher first). */
export async function applyEdgeWeights(
  db: Db,
  category: CategoryId,
  questionIds: string[]
): Promise<string[]> {
  const edges = await db.clarifyDependencyEdge.findMany({
    where: { category, parentAttr: "" },
    select: { childAttr: true, weight: true },
  });
  if (!edges.length) return questionIds;
  const w = new Map(edges.map((e) => [e.childAttr, e.weight]));
  return [...questionIds].sort((a, b) => (w.get(b) ?? 1) - (w.get(a) ?? 1));
}

/**
 * Nightly: recompute option weights from hs_feedback answers;
 * strengthen root edges for attrs that appear in feedback.
 */
export async function reweightClarifyHints(db: Db): Promise<{
  feedback: number;
  optionsUpdated: number;
  edgesUpserted: number;
}> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await db.clarifyHsFeedback.findMany({
    where: { createdAt: { gte: since } },
    select: { category: true, answersJson: true, tokens: true },
    take: 5000,
  });

  const pick = new Map<string, number>(); // category|attrKey|searchValue → count
  const edgeAsk = new Map<string, number>(); // category|childAttr → count

  for (const row of rows) {
    const answers = (row.answersJson || {}) as Record<string, string>;
    for (const [attrKey, searchValue] of Object.entries(answers)) {
      if (!searchValue?.trim()) continue;
      const k = `${row.category}|${attrKey}|${searchValue.trim().toLowerCase()}`;
      pick.set(k, (pick.get(k) || 0) + 1);
      const ek = `${row.category}|${attrKey}`;
      edgeAsk.set(ek, (edgeAsk.get(ek) || 0) + 1);
    }
    if (!Object.keys(answers).length && row.tokens) {
      // token-only feedback: bump generic kind edge
      const ek = `${row.category}|kind`;
      edgeAsk.set(ek, (edgeAsk.get(ek) || 0) + 1);
    }
  }

  let optionsUpdated = 0;
  for (const [key, count] of pick) {
    const [category, attrKey, searchValue] = key.split("|");
    const matches = await db.clarifyAttributeOption.findMany({
      where: {
        category,
        attrKey,
        searchValue: { equals: searchValue, mode: "insensitive" },
      },
    });
    for (const m of matches) {
      const weight = Math.min(10, 1 + Math.log2(1 + count));
      await db.clarifyAttributeOption.update({
        where: { id: m.id },
        data: { weight, pickCount: Math.max(m.pickCount, count) },
      });
      optionsUpdated += 1;
    }
  }

  let edgesUpserted = 0;
  for (const [key, count] of edgeAsk) {
    const [category, childAttr] = key.split("|");
    const weight = Math.min(10, 1 + Math.log2(1 + count));
    await db.clarifyDependencyEdge.upsert({
      where: {
        category_parentAttr_parentValue_childAttr: {
          category,
          parentAttr: "",
          parentValue: "",
          childAttr,
        },
      },
      create: {
        category,
        parentAttr: "",
        parentValue: "",
        childAttr,
        weight,
        askCount: count,
      },
      update: {
        weight,
        askCount: count,
      },
    });
    edgesUpserted += 1;
  }

  return { feedback: rows.length, optionsUpdated, edgesUpserted };
}

/** P3 typeahead: product profiles by prefix / substring. */
export async function searchClarifyProductProfiles(
  db: Pick<PrismaClient, "clarifyProductProfile">,
  query: string,
  limit = 8
): Promise<Array<{ value: string; label: string; score: number; hsCodeDigits?: string | null }>> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await db.clarifyProductProfile.findMany({
    where: {
      canonicalText: { contains: q, mode: "insensitive" },
    },
    orderBy: [{ usageCount: "desc" }, { confidence: "desc" }],
    take: Math.min(limit * 3, 40),
    select: {
      canonicalText: true,
      usageCount: true,
      confidence: true,
      hsCodeDigits: true,
      category: true,
    },
  });
  return rows.slice(0, limit).map((r) => ({
    value: r.canonicalText.slice(0, 200),
    label: r.hsCodeDigits
      ? `${r.canonicalText.slice(0, 80)} · ${r.hsCodeDigits}`
      : r.canonicalText.slice(0, 100),
    score: Math.min(1, 0.4 + r.usageCount * 0.05 + r.confidence * 0.3),
    hsCodeDigits: r.hsCodeDigits,
  }));
}
