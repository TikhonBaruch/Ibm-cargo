/**
 * Mirror of src/lib/ved/precedent-embeddings.ts for containers/api dual-path.
 */

export const PRECEDENT_EMBED_DIM = Number(process.env.PRECEDENT_EMBED_DIM || "1024");

export const PRECEDENT_VECTOR_THRESHOLD = Number(
  process.env.PRECEDENT_VECTOR_THRESHOLD || "0.78"
);

const EMBED_TIMEOUT_MS = Number(process.env.PRECEDENT_EMBED_TIMEOUT_MS || "15000");

export function isPrecedentEmbeddingEnabled() {
  if (process.env.PRECEDENT_VECTOR_ENABLED === "0") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function resolveEmbedModel() {
  if (process.env.PRECEDENT_EMBED_MODEL?.trim()) {
    return process.env.PRECEDENT_EMBED_MODEL.trim();
  }
  const base = (process.env.OPENAI_BASE_URL || "").toLowerCase();
  if (base.includes("nvidia")) return "nvidia/nv-embedqa-e5-v5";
  return "text-embedding-3-small";
}

export function cosineSimilarity(a, b) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function toVectorLiteral(embedding) {
  const dim = PRECEDENT_EMBED_DIM;
  const slice = embedding.slice(0, dim);
  while (slice.length < dim) slice.push(0);
  return `[${slice.map((v) => Number(v).toFixed(8)).join(",")}]`;
}

export async function embedCanonicalText(text) {
  if (!isPrecedentEmbeddingEnabled()) return null;
  const key = process.env.OPENAI_API_KEY.trim();
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = resolveEmbedModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  try {
    const body = { model, input: text.slice(0, 8000) };
    if (model.startsWith("text-embedding-3")) {
      body.dimensions = PRECEDENT_EMBED_DIM;
    }
    const res = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length < 8) return null;
    return vec.slice(0, PRECEDENT_EMBED_DIM);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function storePrecedentEmbedding(db, precedentId, canonicalText) {
  const embedding = await embedCanonicalText(canonicalText);
  if (!embedding) return false;
  const literal = toVectorLiteral(embedding);
  try {
    await db.$executeRawUnsafe(
      `UPDATE verified_determinations SET embedding = $1::vector(${PRECEDENT_EMBED_DIM}) WHERE id = $2`,
      literal,
      precedentId
    );
    return true;
  } catch {
    return false;
  }
}

export async function findVectorPrecedent(db, queryEmbedding, threshold = PRECEDENT_VECTOR_THRESHOLD) {
  const literal = toVectorLiteral(queryEmbedding);
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT id, "hsCodeFinal", "hsCodeDigits", "dutyRub", "vatRub", "feeRub",
              1 - (embedding <=> $1::vector(${PRECEDENT_EMBED_DIM})) AS similarity
       FROM verified_determinations
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector(${PRECEDENT_EMBED_DIM})
       LIMIT 1`,
      literal
    );
    const best = rows[0];
    if (!best || Number(best.similarity) < threshold) return null;
    return { ...best, similarity: Number(best.similarity) };
  } catch {
    return null;
  }
}
