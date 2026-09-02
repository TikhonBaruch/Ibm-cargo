/**
 * БД-2: broker-approved HS precedents — lexical match before LLM classify (Growth local).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { formatHsCode, normalizeHsCode } from "./tnved";
import type { ProductAttrs } from "./product-description";
import {
  embedCanonicalText,
  findVectorPrecedent,
  isPrecedentEmbeddingEnabled,
  storePrecedentEmbedding,
} from "./precedent-embeddings";

export const PRECEDENT_MATCH_THRESHOLD = Number(
  process.env.PRECEDENT_MATCH_THRESHOLD || "0.85"
);

export const PRECEDENT_SCAN_LIMIT = Math.min(
  500,
  Math.max(50, Number(process.env.PRECEDENT_SCAN_LIMIT || "200"))
);

export type PrecedentMatchInput = {
  title?: string;
  description?: string;
  name?: string;
  attrs?: ProductAttrs | null;
};

export type PrecedentMatchResult = {
  id: string;
  hsCode: string;
  hsCodeDigits: string;
  confidence: number;
  score: number;
  engine: "precedent-v1" | "precedent-v2";
  disclaimer: string;
  precedentId: string;
  dutyRub?: number | null;
  vatRub?: number | null;
  feeRub?: number | null;
};

export function tokenize(text: string): string[] {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  // Latin/Cyrillic words ≥3 chars; keep CJK runs (CN) so fingerprint is non-empty.
  const tokens = normalized.match(/[a-zа-я0-9]{3,}|[\u4e00-\u9fff]+/g);
  return tokens || [];
}

/** Canonical text for fingerprint + lexical scoring. */
export function buildCanonicalText(input: PrecedentMatchInput): string {
  const parts = [
    input.name,
    input.title,
    input.description,
    input.attrs?.brand,
    input.attrs?.model,
    input.attrs?.material,
    input.attrs?.composition,
    input.attrs?.purpose,
    input.attrs?.extra?.sku,
    input.attrs?.extra?.color,
    input.attrs?.extra?.ageGroup,
    input.attrs?.extra?.garmentType,
    input.attrs?.extra?.powerSource,
    input.attrs?.extra?.vehicleKind,
  ].filter(Boolean);
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable fingerprint for exact match. */
export function buildFingerprint(input: PrecedentMatchInput): string {
  const canonical = buildCanonicalText(input);
  const tokens = [...new Set(tokenize(canonical))].sort();
  return tokens.join("|");
}

export function lexicalScore(query: string, candidate: string): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const cSet = new Set(tokenize(candidate));
  let hits = 0;
  for (const t of qTokens) {
    if (cSet.has(t)) hits += 1;
  }
  return hits / qTokens.length;
}

type DbLike = Pick<PrismaClient, "verifiedDetermination"> & {
  $queryRawUnsafe?: PrismaClient["$queryRawUnsafe"];
  $executeRawUnsafe?: PrismaClient["$executeRawUnsafe"];
};

/** Find best precedent; null if below threshold. Fail-open: errors → null. */
export async function findBestPrecedent(
  db: DbLike,
  input: PrecedentMatchInput,
  threshold = PRECEDENT_MATCH_THRESHOLD
): Promise<PrecedentMatchResult | null> {
  try {
    const canonical = buildCanonicalText(input);
    if (!canonical || canonical.length < 3) return null;

    const fingerprint = buildFingerprint(input);
    const exact = await db.verifiedDetermination.findFirst({
      where: { fingerprint },
      orderBy: { approvedAt: "desc" },
    });
    if (exact) {
      await db.verifiedDetermination.update({
        where: { id: exact.id },
        data: { usageCount: { increment: 1 } },
      });
      return toMatchResult(exact, 1, "precedent-v1");
    }

    if (
      isPrecedentEmbeddingEnabled() &&
      typeof db.$queryRawUnsafe === "function" &&
      typeof db.$executeRawUnsafe === "function"
    ) {
      const queryEmbedding = await embedCanonicalText(canonical);
      if (queryEmbedding) {
        const vectorHit = await findVectorPrecedent(
          db as Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">,
          queryEmbedding
        );
        if (vectorHit) {
          await db.verifiedDetermination.update({
            where: { id: vectorHit.id },
            data: { usageCount: { increment: 1 } },
          });
          return toMatchResult(vectorHit, vectorHit.similarity, "precedent-v2");
        }
      }
    }

    const recent = await db.verifiedDetermination.findMany({
      orderBy: { approvedAt: "desc" },
      take: PRECEDENT_SCAN_LIMIT,
    });
    let best: (typeof recent)[0] | null = null;
    let bestScore = 0;
    for (const row of recent) {
      let score = lexicalScore(canonical, row.canonicalText);
      if (row.quality === "CLIENT_HELPFUL") score += 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }
    if (!best || bestScore < threshold) return null;

    await db.verifiedDetermination.update({
      where: { id: best.id },
      data: { usageCount: { increment: 1 } },
    });
    return toMatchResult(best, bestScore, "precedent-v1");
  } catch {
    return null;
  }
}

function toMatchResult(
  row: {
    id: string;
    hsCodeFinal: string;
    hsCodeDigits: string;
    dutyRub: number | null;
    vatRub: number | null;
    feeRub: number | null;
  },
  score: number,
  engine: "precedent-v1" | "precedent-v2"
): PrecedentMatchResult {
  const hs =
    formatHsCode(row.hsCodeDigits) || row.hsCodeFinal;
  const disclaimer =
    engine === "precedent-v2"
      ? "Семантическое совпадение с ранее утверждённым брокером определением (precedent-v2). Требуется проверка при изменении товара."
      : "Совпадение с ранее утверждённым брокером определением (precedent-v1). Требуется проверка при изменении товара.";
  return {
    id: row.id,
    precedentId: row.id,
    hsCode: hs,
    hsCodeDigits: row.hsCodeDigits,
    confidence: Math.min(0.98, 0.7 + score * 0.28),
    score,
    engine,
    disclaimer,
    dutyRub: row.dutyRub,
    vatRub: row.vatRub,
    feeRub: row.feeRub,
  };
}

export type SimilarPrecedent = {
  id: string;
  hsCode: string;
  hsCodeDigits: string;
  quality: string;
  score: number;
  canonicalText: string;
  attrsSnapshot?: unknown;
};

/** List similar approved HS (no usage bump). Prefer client-helpful quality. */
export async function listSimilarPrecedents(
  db: DbLike,
  input: PrecedentMatchInput,
  limit = 3
): Promise<SimilarPrecedent[]> {
  try {
    const canonical = buildCanonicalText(input);
    if (!canonical || canonical.length < 3) return [];
    const recent = await db.verifiedDetermination.findMany({
      orderBy: { approvedAt: "desc" },
      take: PRECEDENT_SCAN_LIMIT,
    });
    const ranked = recent
      .map((row) => {
        let score = lexicalScore(canonical, row.canonicalText);
        if (row.quality === "CLIENT_HELPFUL") score += 0.05;
        return { row, score };
      })
      .filter((x) => x.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return ranked.map(({ row, score }) => ({
      id: row.id,
      hsCode: formatHsCode(row.hsCodeDigits) || row.hsCodeFinal,
      hsCodeDigits: row.hsCodeDigits,
      quality: row.quality,
      score,
      canonicalText: row.canonicalText.slice(0, 180),
      attrsSnapshot: row.attrsSnapshot,
    }));
  } catch {
    return [];
  }
}

export type RecordPrecedentItem = {
  name: string;
  description?: string | null;
  attrs?: ProductAttrs | null;
  hsCodeFinal: string;
  dutyRub?: number | null;
  vatRub?: number | null;
  feeRub?: number | null;
  itemId?: string;
};

/** Write-back precedents after broker approve (one row per item). */
export async function recordVerifiedFromApprove(
  db: DbLike,
  opts: {
    calculationId: string;
    approvedByUserId: string;
    brokerComment?: string | null;
    title?: string | null;
    quality?: string | null;
    items: RecordPrecedentItem[];
  }
): Promise<number> {
  let written = 0;
  for (const item of opts.items) {
    const digits = normalizeHsCode(item.hsCodeFinal);
    if (!digits) continue;
    const input: PrecedentMatchInput = {
      name: item.name,
      title: opts.title || undefined,
      description: item.description || undefined,
      attrs: item.attrs,
    };
    const canonicalText = buildCanonicalText(input);
    const fingerprint = buildFingerprint(input);
    if (!canonicalText) continue;

    const created = await db.verifiedDetermination.create({
      data: {
        fingerprint,
        canonicalText,
        attrsSnapshot: (item.attrs || undefined) as Prisma.InputJsonValue | undefined,
        hsCodeFinal: formatHsCode(digits) || item.hsCodeFinal,
        hsCodeDigits: digits,
        dutyRub: item.dutyRub != null ? Math.round(item.dutyRub) : null,
        vatRub: item.vatRub != null ? Math.round(item.vatRub) : null,
        feeRub: item.feeRub != null ? Math.round(item.feeRub) : null,
        brokerComment: opts.brokerComment || null,
        sourceCalculationId: opts.calculationId,
        sourceItemId: item.itemId || null,
        approvedByUserId: opts.approvedByUserId,
        quality: opts.quality === "CLIENT_HELPFUL" ? "CLIENT_HELPFUL" : "BROKER",
      },
    });
    if (typeof db.$executeRawUnsafe === "function") {
      await storePrecedentEmbedding(
        db as Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">,
        created.id,
        canonicalText
      );
    }
    written += 1;
  }
  return written;
}
