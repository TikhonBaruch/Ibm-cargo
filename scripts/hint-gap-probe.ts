#!/usr/bin/env npx tsx
/**
 * Offline hint coverage gap probe (Cov-P12).
 *
 *   npm run probe:hint-gap
 *   npm run probe:hint-gap -- --phase Cov-P7
 *   npm run probe:hint-gap -- --live --format table
 *   npm run probe:hint-gap -- --fail-on steal,misroute
 *
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md
 */
import dictionaryJson from "../src/lib/ved/__tests__/hint-coverage-probe-dictionary.json";
import { matchHintPack } from "../src/lib/ved/tnved-hint-trees";
import {
  heuristicAttrSuggest,
  attrSuggestIsClarifyOnly,
} from "../src/lib/ved/attr-suggest";
import { classifyTnvedCascade } from "../src/lib/ved/tnved-classify";

type DictRow = {
  id: string;
  query: string;
  phase: string;
  expected: { pack: string | null; attr: string; searchPrefix: string | null };
  mustNotPack?: string[];
  live?: boolean;
};

const dictionary = dictionaryJson as { rows: DictRow[] };

const args = process.argv.slice(2);
function flag(name: string) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const phase = flag("--phase");
const liveOnly = args.includes("--live");
const format = flag("--format") || "table";
const failOn = (flag("--fail-on") || "").split(",").filter(Boolean);

const GENERIC = "уточните назначение товара";
const mockDb = {
  tnvedCode: { findUnique: async () => null, findMany: async () => [] },
} as never;

function attrLayer(out: ReturnType<typeof heuristicAttrSuggest>) {
  if (attrSuggestIsClarifyOnly(out)) return "A~";
  if (out.attrs.hsHint) return "A+";
  if (out.attrs.purpose === GENERIC) return "A0";
  return "A+";
}

async function main() {
  let rows = dictionary.rows;
  if (phase) rows = rows.filter((r) => r.phase === phase);
  if (liveOnly) rows = rows.filter((r) => r.live);

  const results: Array<{
    id: string;
    query: string;
    phase: string;
    kind: string;
    pack: string | null;
    wantPack: string | null;
    attr: string;
    wantAttr: string;
    hs: string | null;
    wantHs: string | null;
  }> = [];

  for (const row of rows) {
    const pack = matchHintPack(row.query)?.id ?? null;
    const attr = heuristicAttrSuggest({ description: row.query });
    const layer = attrLayer(attr);
    const hit = await classifyTnvedCascade(mockDb, { description: row.query });
    const hs = hit?.hsCode?.replace(/\D/g, "") || null;
    const mustNot = row.mustNotPack || [];

    let kind = "OK";
    if (row.expected.pack === null) {
      if (pack !== null) kind = "FALSE-POS";
    } else if (pack !== row.expected.pack) {
      kind = pack && mustNot.includes(pack) ? "STEAL" : "MISROUTE";
    }
    for (const bad of mustNot) {
      if (pack === bad) kind = "STEAL";
    }
    if (kind === "OK" && layer !== row.expected.attr) {
      if (row.expected.attr !== "A0" && layer === "A0") kind = "ATTR-GAP";
      else kind = "LAYER-SPLIT";
    }
    if (
      kind === "OK" &&
      row.expected.searchPrefix &&
      (!hs || !hs.startsWith(row.expected.searchPrefix.replace(/\D/g, "")))
    ) {
      kind = "SEARCH-MISS";
    }

    results.push({
      id: row.id,
      query: row.query,
      phase: row.phase,
      kind,
      pack,
      wantPack: row.expected.pack,
      attr: layer,
      wantAttr: row.expected.attr,
      hs: hs?.slice(0, 6) || null,
      wantHs: row.expected.searchPrefix,
    });
  }

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.kind] = (counts[r.kind] || 0) + 1;

  if (format === "json") {
    console.log(JSON.stringify({ counts, results }, null, 2));
  } else {
    console.log(`# hint-gap-probe  rows=${results.length}  ${JSON.stringify(counts)}`);
    console.log("kind\tquery\tpack\twantPack\tattr\ths");
    for (const r of results) {
      if (r.kind === "OK" && format === "misses") continue;
      console.log(
        [r.kind, r.query, r.pack ?? "null", r.wantPack ?? "null", r.attr, r.hs ?? "-"].join("\t"),
      );
    }
  }

  const bad = results.filter(
    (r) => failOn.includes(r.kind.toLowerCase()) || failOn.includes(r.kind),
  );
  if (failOn.length && bad.length) {
    console.error(`fail-on ${failOn.join(",")}: ${bad.length} hits`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
