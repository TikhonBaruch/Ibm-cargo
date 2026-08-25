/**
 * Mirror of src/lib/ved/verified-determinations.ts for containers/api dual-path.
 */
import { normalizeHsCode, formatHsCode } from "./tnved-helpers.js";
import {
  embedCanonicalText,
  findVectorPrecedent,
  isPrecedentEmbeddingEnabled,
  storePrecedentEmbedding,
} from "./precedent-embeddings.js";

export const PRECEDENT_MATCH_THRESHOLD = Number(
  process.env.PRECEDENT_MATCH_THRESHOLD || "0.85"
);
export const PRECEDENT_SCAN_LIMIT = Math.min(
  500,
  Math.max(50, Number(process.env.PRECEDENT_SCAN_LIMIT || "200"))
);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter((t) => t.length >= 3);
}

export function buildCanonicalText(input) {
  const parts = [
    input.name,
    input.title,
    input.description,
    input.attrs?.brand,
    input.attrs?.sku,
    input.attrs?.material,
    input.attrs?.purpose,
    input.attrs?.model,
  ].filter(Boolean);
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildFingerprint(input) {
  const canonical = buildCanonicalText(input);
  const tokens = [...new Set(tokenize(canonical))].sort();
  return tokens.join("|");
}

function lexicalScore(query, candidate) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const cSet = new Set(tokenize(candidate));
  let hits = 0;
  for (const t of qTokens) if (cSet.has(t)) hits += 1;
  return hits / qTokens.length;
}

function toMatchResult(row, score, engine) {
  const hs = formatHsCode(row.hsCodeDigits) || row.hsCodeFinal;
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

export async function findBestPrecedent(prisma, input, threshold = PRECEDENT_MATCH_THRESHOLD) {
  try {
    const canonical = buildCanonicalText(input);
    if (!canonical || canonical.length < 3) return null;

    const fingerprint = buildFingerprint(input);
    const exact = await prisma.verifiedDetermination.findFirst({
      where: { fingerprint },
      orderBy: { approvedAt: "desc" },
    });
    if (exact) {
      await prisma.verifiedDetermination.update({
        where: { id: exact.id },
        data: { usageCount: { increment: 1 } },
      });
      return toMatchResult(exact, 1, "precedent-v1");
    }

    if (isPrecedentEmbeddingEnabled()) {
      const queryEmbedding = await embedCanonicalText(canonical);
      if (queryEmbedding) {
        const vectorHit = await findVectorPrecedent(prisma, queryEmbedding);
        if (vectorHit) {
          await prisma.verifiedDetermination.update({
            where: { id: vectorHit.id },
            data: { usageCount: { increment: 1 } },
          });
          return toMatchResult(vectorHit, vectorHit.similarity, "precedent-v2");
        }
      }
    }

    const recent = await prisma.verifiedDetermination.findMany({
      orderBy: { approvedAt: "desc" },
      take: PRECEDENT_SCAN_LIMIT,
    });
    let best = null;
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

    await prisma.verifiedDetermination.update({
      where: { id: best.id },
      data: { usageCount: { increment: 1 } },
    });
    return toMatchResult(best, bestScore, "precedent-v1");
  } catch {
    return null;
  }
}

export async function recordVerifiedFromApprove(prisma, opts) {
  let written = 0;
  for (const item of opts.items) {
    const digits = normalizeHsCode(item.hsCodeFinal);
    if (!digits) continue;
    const input = {
      name: item.name,
      title: opts.title || undefined,
      description: item.description || undefined,
      attrs: item.attrs,
    };
    const canonicalText = buildCanonicalText(input);
    const fingerprint = buildFingerprint(input);
    if (!canonicalText) continue;

    const created = await prisma.verifiedDetermination.create({
      data: {
        fingerprint,
        canonicalText,
        attrsSnapshot: item.attrs || undefined,
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
    await storePrecedentEmbedding(prisma, created.id, canonicalText);
    written += 1;
  }
  return written;
}

export async function listSimilarPrecedents(prisma, input, limit = 3) {
  try {
    const canonical = buildCanonicalText(input);
    if (!canonical || canonical.length < 3) return [];
    const recent = await prisma.verifiedDetermination.findMany({
      orderBy: { approvedAt: "desc" },
      take: PRECEDENT_SCAN_LIMIT,
    });
    return recent
      .map((row) => {
        let score = lexicalScore(canonical, row.canonicalText);
        if (row.quality === "CLIENT_HELPFUL") score += 0.05;
        return { row, score };
      })
      .filter((x) => x.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, score }) => ({
        id: row.id,
        hsCode: formatHsCode(row.hsCodeDigits) || row.hsCodeFinal,
        hsCodeDigits: row.hsCodeDigits,
        quality: row.quality,
        score,
        canonicalText: String(row.canonicalText || "").slice(0, 180),
        attrsSnapshot: row.attrsSnapshot,
      }));
  } catch {
    return [];
  }
}
