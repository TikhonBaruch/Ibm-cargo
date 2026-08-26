import type { PrismaClient } from "@prisma/client";
import {
  filterFieldSuggestions,
  fieldSuggestDisplay,
  type FieldSuggestKind,
} from "../field-suggest";
import { lexicalScore, tokenize } from "../verified-determinations";
import { searchClarifyProductProfiles } from "../clarify-hints/learning";
import type { PrecedentSuggestHit } from "./schema";
import { guardSuggestQuery } from "./query-guard";

type DbLike = Pick<
  PrismaClient,
  | "calculation"
  | "calculationItem"
  | "verifiedDetermination"
  | "user"
  | "clarifyProductProfile"
>;

const CALC_SCAN = 40;
const PRECEDENT_SCAN = 80;

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function pushHit(
  map: Map<string, PrecedentSuggestHit>,
  hit: PrecedentSuggestHit
): void {
  const key = hit.value.toLowerCase();
  const prev = map.get(key);
  if (!prev || (hit.score ?? 0) > (prev.score ?? 0)) map.set(key, hit);
}

function scoreQuery(query: string, candidate: string): number {
  if (!query) return 0.5;
  return lexicalScore(query, candidate);
}

async function companyIdForUser(db: DbLike, userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  return user?.companyId ?? null;
}

async function fromPastCalculations(
  db: DbLike,
  kind: FieldSuggestKind,
  query: string,
  companyId: string | null,
  limit: number
): Promise<PrecedentSuggestHit[]> {
  if (!companyId) return [];
  const q = query.trim();
  const whereBase = {
    companyId,
    title: { not: "" },
  } as const;

  const textFilter =
    q.length >= 2
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { country: { contains: q, mode: "insensitive" as const } },
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

  const map = new Map<string, PrecedentSuggestHit>();

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
        const attrs = (it.attrs || {}) as Record<string, unknown>;
        const extra = (attrs.extra || {}) as Record<string, unknown>;
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
        void extra;
      }
    }
  }

  return [...map.values()]
    .filter((h) => !q || scoreQuery(q, h.value) >= 0.2)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

async function fromVerifiedPrecedents(
  db: DbLike,
  kind: FieldSuggestKind,
  query: string,
  limit: number
): Promise<PrecedentSuggestHit[]> {
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

  const map = new Map<string, PrecedentSuggestHit>();

  for (const row of rows) {
    const canonical = row.canonicalText || "";
    const attrs = (row.attrsSnapshot || {}) as Record<string, unknown>;

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

function fromLocalFallback(kind: FieldSuggestKind, query: string, limit: number): PrecedentSuggestHit[] {
  return filterFieldSuggestions(kind, query, limit).map((e) => ({
    value: e.value,
    label: fieldSuggestDisplay(e),
    source: "local" as const,
    score: 0.1,
  }));
}

/** Precedent + past calc suggestions; merges local catalog as fail-open tail. */
export async function searchPrecedentSuggestions(
  db: DbLike,
  opts: {
    kind: FieldSuggestKind;
    q: string;
    userId: string;
    limit?: number;
  }
): Promise<{ items: PrecedentSuggestHit[]; rejected?: string }> {
  const limit = Math.min(20, Math.max(1, opts.limit ?? 8));
  const guarded = guardSuggestQuery(opts.q);
  if (!guarded.ok) {
    if (guarded.reason === "empty") {
      return { items: fromLocalFallback(opts.kind, "", limit) };
    }
    return { items: [], rejected: guarded.reason };
  }

  const query = guarded.query;
  const companyId = await companyIdForUser(db, opts.userId);

  const [past, precedents, profiles] = await Promise.all([
    fromPastCalculations(db, opts.kind, query, companyId, limit),
    fromVerifiedPrecedents(db, opts.kind, query, limit),
    opts.kind === "partyDescription" || opts.kind === "itemName"
      ? searchClarifyProductProfiles(db, query, limit).then((rows) =>
          rows.map(
            (r): PrecedentSuggestHit => ({
              value: r.value,
              label: r.label,
              source: "profile" as PrecedentSuggestHit["source"],
              score: r.score,
            })
          )
        )
      : Promise.resolve([] as PrecedentSuggestHit[]),
  ]);

  const merged = new Map<string, PrecedentSuggestHit>();
  for (const h of [...profiles, ...precedents, ...past]) pushHit(merged, h);

  let items = [...merged.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (items.length < limit) {
    const local = fromLocalFallback(opts.kind, query, limit);
    for (const h of local) {
      if (items.length >= limit) break;
      if (!merged.has(h.value.toLowerCase())) items.push(h);
    }
  }

  items = items.slice(0, limit);
  return { items };
}
