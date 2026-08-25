/**
 * Mirror of src/lib/ved/precedent-suggest/search.ts (without local field-suggest tail).
 */
import { guardSuggestQuery } from "./query-guard.js";
import { lexicalScore, tokenize } from "./lexical.js";

const CALC_SCAN = 40;
const PRECEDENT_SCAN = 80;

const SUGGEST_KINDS = new Set([
  "itemName",
  "partyDescription",
  "shipCountry",
  "originCountry",
  "material",
  "brand",
  "composition",
]);

function norm(s) {
  return s.trim().replace(/\s+/g, " ");
}

function pushHit(map, hit) {
  const key = hit.value.toLowerCase();
  const prev = map.get(key);
  if (!prev || (hit.score ?? 0) > (prev.score ?? 0)) map.set(key, hit);
}

function scoreQuery(query, candidate) {
  if (!query) return 0.5;
  return lexicalScore(query, candidate);
}

async function companyIdForUser(db, userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  return user?.companyId ?? null;
}

async function fromPastCalculations(db, kind, query, companyId, limit) {
  if (!companyId) return [];
  const q = query.trim();
  const whereBase = {
    companyId,
    title: { not: "" },
  };

  const textFilter =
    q.length >= 2
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { country: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

  const calcs = await db.calculation.findMany({
    where: { ...whereBase, ...textFilter },
    orderBy: { createdAt: "desc" },
    take: CALC_SCAN,
    select: {
      title: true,
      description: true,
      country: true,
      items: {
        select: { name: true, description: true, attrs: true },
        take: 5,
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const map = new Map();

  for (const c of calcs) {
    if (kind === "itemName") {
      pushHit(map, {
        value: norm(c.title),
        source: "past_calc",
        score: scoreQuery(q, c.title),
      });
      for (const it of c.items) {
        if (it.name?.trim()) {
          pushHit(map, {
            value: norm(it.name),
            source: "past_calc",
            score: scoreQuery(q, it.name),
          });
        }
      }
    }
    if (kind === "partyDescription" && c.description?.trim()) {
      pushHit(map, {
        value: norm(c.description).slice(0, 500),
        source: "past_calc",
        score: scoreQuery(q, c.description),
      });
      for (const it of c.items) {
        if (it.description?.trim()) {
          pushHit(map, {
            value: norm(it.description).slice(0, 500),
            source: "past_calc",
            score: scoreQuery(q, it.description),
          });
        }
      }
    }
    if (kind === "shipCountry" && c.country?.trim()) {
      pushHit(map, {
        value: norm(c.country),
        source: "past_calc",
        score: scoreQuery(q, c.country),
      });
    }
    if (kind === "originCountry" || kind === "material" || kind === "brand" || kind === "composition") {
      for (const it of c.items) {
        const attrs = it.attrs || {};
        const field =
          kind === "originCountry"
            ? String(attrs.originCountry || "")
            : kind === "material"
              ? String(attrs.material || "")
              : kind === "brand"
                ? String(attrs.brand || "")
                : String(attrs.composition || "");
        if (!field.trim()) continue;
        pushHit(map, {
          value: norm(field),
          label: kind === "originCountry" ? field.toUpperCase() : undefined,
          source: "past_calc",
          score: scoreQuery(q, field),
        });
      }
    }
  }

  return [...map.values()]
    .filter((h) => !q || scoreQuery(q, h.value) >= 0.2)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

async function fromVerifiedPrecedents(db, kind, query, limit) {
  const q = query.trim();
  const rows = await db.verifiedDetermination.findMany({
    where:
      q.length >= 2
        ? { canonicalText: { contains: q, mode: "insensitive" } }
        : undefined,
    orderBy: [{ usageCount: "desc" }, { approvedAt: "desc" }],
    take: PRECEDENT_SCAN,
    select: {
      canonicalText: true,
      attrsSnapshot: true,
      quality: true,
    },
  });

  const map = new Map();

  for (const row of rows) {
    const canonical = row.canonicalText || "";
    const attrs = row.attrsSnapshot || {};

    if (kind === "itemName") {
      const tokens = tokenize(canonical);
      const head = tokens.slice(0, 4).join(" ");
      if (head) {
        pushHit(map, {
          value: head,
          source: "precedent",
          score: scoreQuery(q, canonical) + (row.quality === "CLIENT_HELPFUL" ? 0.05 : 0),
        });
      }
    }
    if (kind === "partyDescription" && canonical.length >= 8) {
      pushHit(map, {
        value: canonical.slice(0, 500),
        source: "precedent",
        score: scoreQuery(q, canonical),
      });
    }
    const attrField =
      kind === "originCountry"
        ? String(attrs.originCountry || "")
        : kind === "material"
          ? String(attrs.material || "")
          : kind === "brand"
            ? String(attrs.brand || "")
            : kind === "composition"
              ? String(attrs.composition || "")
              : "";
    if (attrField.trim()) {
      pushHit(map, {
        value: norm(attrField),
        source: "precedent",
        score: scoreQuery(q, attrField) + (row.quality === "CLIENT_HELPFUL" ? 0.05 : 0),
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

/** Precedent + past calc suggestions scoped to company. */
export async function searchPrecedentSuggestions(db, opts) {
  const limit = Math.min(20, Math.max(1, opts.limit ?? 8));
  const kind = opts.kind;
  if (!SUGGEST_KINDS.has(kind)) {
    return { items: [], rejected: "invalid_kind" };
  }

  const guarded = guardSuggestQuery(opts.q);
  if (!guarded.ok) {
    return { items: [], rejected: guarded.reason };
  }

  const query = guarded.query;
  const companyId = await companyIdForUser(db, opts.userId);

  const [past, precedents] = await Promise.all([
    fromPastCalculations(db, kind, query, companyId, limit),
    fromVerifiedPrecedents(db, kind, query, limit),
  ]);

  const merged = new Map();
  for (const h of [...precedents, ...past]) pushHit(merged, h);

  const items = [...merged.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  return { items };
}
