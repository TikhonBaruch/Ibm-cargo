#!/usr/bin/env npx tsx
/**
 * Offline hint coverage gap probe (Cov-P12).
 *
 *   npm run probe:hint-gap
 *   npm run probe:hint-gap -- --phase Cov-P7
 *   npm run probe:hint-gap -- --live --format table
 *   npm run probe:hint-gap -- --fail-on steal,misroute
 *   npm run probe:hint-gap -- --full
 *   npm run probe:hint-gap -- --full --source plan-s7 --format summary
 *
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md
 *
 * Golden dictionary (default): hard expected → OK / STEAL / MISROUTE / …
 * --full corpus: observe-only → PACK / ATTR / CASCADE / MISS / POLICY / DIVERGE
 *   (no expected; wantPack is a hint, never fail-on steal)
 */
import dictionaryJson from "../src/lib/ved/__tests__/hint-coverage-probe-dictionary.json";
import fullCorpusJson from "../src/lib/ved/__tests__/hint-coverage-full-corpus.json";
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

type CorpusRow = {
  id: string;
  query: string;
  domain: string;
  source: string;
  policy: boolean;
  wantPack: string | null;
};

type ProbeRow = {
  id: string;
  query: string;
  phase: string;
  domain?: string;
  source?: string;
  kind: string;
  pack: string | null;
  wantPack: string | null;
  attr: string;
  wantAttr: string;
  hs: string | null;
  wantHs: string | null;
  policy?: boolean;
};

const dictionary = dictionaryJson as { rows: DictRow[] };
const fullCorpus = fullCorpusJson as { rows: CorpusRow[] };

const args = process.argv.slice(2);
function flag(name: string) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const phase = flag("--phase");
const liveOnly = args.includes("--live");
const fullMode = args.includes("--full");
const sourceFilter = flag("--source");
const domainFilter = flag("--domain");
const format =
  flag("--format") || (fullMode ? "summary" : "table");
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

function observeKind(opts: {
  policy: boolean;
  pack: string | null;
  wantPack: string | null;
  layer: string;
  hs: string | null;
}): string {
  const { policy, pack, wantPack, layer, hs } = opts;
  if (policy) {
    if (pack) return "POLICY-HIT";
    return "POLICY";
  }
  if (pack) {
    if (wantPack && pack !== wantPack) return "DIVERGE";
    return "PACK";
  }
  if (layer === "A+" || layer === "A~") return "ATTR";
  if (hs) return "CASCADE";
  return "MISS";
}

function countsOf(results: ProbeRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.kind] = (counts[r.kind] || 0) + 1;
  return counts;
}

function coverageOf(results: ProbeRow[]) {
  const n = results.length;
  const policy = results.filter((r) => r.policy || r.kind.startsWith("POLICY")).length;
  const denom = Math.max(1, n - policy);
  const packHit = results.filter((r) => r.pack && !r.policy).length;
  const attrHelp = results.filter(
    (r) => !r.pack && !r.policy && (r.attr === "A+" || r.attr === "A~"),
  ).length;
  const cascadeHelp = results.filter(
    (r) => !r.pack && !r.policy && r.attr === "A0" && r.hs,
  ).length;
  const anyHelp = packHit + attrHelp + cascadeHelp;
  const miss = results.filter((r) => r.kind === "MISS").length;
  const diverge = results.filter((r) => r.kind === "DIVERGE").length;
  const pct = (x: number, d = denom) => Math.round((1000 * x) / d) / 10;
  return {
    n,
    policy,
    denom,
    packHit,
    attrHelp,
    cascadeHelp,
    anyHelp,
    miss,
    diverge,
    packPct: pct(packHit),
    anyPct: pct(anyHelp),
    missPct: pct(miss),
  };
}

function printSummary(label: string, results: ProbeRow[]) {
  const counts = countsOf(results);
  const cov = coverageOf(results);
  console.log(`# ${label}  rows=${cov.n}  policy=${cov.policy}  denom=${cov.denom}`);
  console.log(
    `  pack-hit ${cov.packHit}/${cov.denom} = ${cov.packPct}%   any-help ${cov.anyHelp}/${cov.denom} = ${cov.anyPct}%   miss ${cov.miss} (${cov.missPct}%)   diverge ${cov.diverge}`,
  );
  console.log(`  kinds ${JSON.stringify(counts)}`);
}

async function runGolden(): Promise<ProbeRow[]> {
  let rows = dictionary.rows;
  if (phase) rows = rows.filter((r) => r.phase === phase);
  if (liveOnly) rows = rows.filter((r) => r.live);

  const results: ProbeRow[] = [];
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
  return results;
}

async function runFull(): Promise<ProbeRow[]> {
  let rows = fullCorpus.rows;
  if (sourceFilter) rows = rows.filter((r) => r.source === sourceFilter);
  if (domainFilter) rows = rows.filter((r) => r.domain === domainFilter);

  const results: ProbeRow[] = [];
  for (const row of rows) {
    const pack = matchHintPack(row.query)?.id ?? null;
    const attr = heuristicAttrSuggest({ description: row.query });
    const layer = attrLayer(attr);
    const hit = await classifyTnvedCascade(mockDb, { description: row.query });
    const hs = hit?.hsCode?.replace(/\D/g, "") || null;
    const kind = observeKind({
      policy: row.policy,
      pack,
      wantPack: row.wantPack,
      layer,
      hs,
    });
    results.push({
      id: row.id,
      query: row.query,
      phase: "full",
      domain: row.domain,
      source: row.source,
      kind,
      pack,
      wantPack: row.wantPack,
      attr: layer,
      wantAttr: "",
      hs: hs?.slice(0, 6) || null,
      wantHs: null,
      policy: row.policy,
    });
  }
  return results;
}

function printTable(results: ProbeRow[]) {
  console.log("kind\tquery\tpack\twantPack\tattr\ths");
  for (const r of results) {
    if (r.kind === "OK" && format === "misses") continue;
    if (fullMode && format === "misses" && r.kind === "PACK") continue;
    if (fullMode && format === "misses" && r.kind === "POLICY") continue;
    console.log(
      [r.kind, r.query, r.pack ?? "null", r.wantPack ?? "null", r.attr, r.hs ?? "-"].join(
        "\t",
      ),
    );
  }
}

async function main() {
  const results = fullMode ? await runFull() : await runGolden();
  const counts = countsOf(results);

  if (format === "json") {
    const payload: Record<string, unknown> = { counts, results };
    if (fullMode) {
      payload.coverage = coverageOf(results);
      const household = results.filter((r) => r.source === "plan-s7");
      if (household.length) payload.household = coverageOf(household);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (format === "summary") {
    printSummary(fullMode ? "hint-gap-probe --full" : "hint-gap-probe", results);
    if (fullMode) {
      const household = results.filter((r) => r.source === "plan-s7");
      if (household.length && household.length !== results.length) {
        printSummary("household plan-s7", household);
      }
      const byDomain = new Map<string, ProbeRow[]>();
      for (const r of results) {
        const d = r.domain || "other";
        const list = byDomain.get(d) || [];
        list.push(r);
        byDomain.set(d, list);
      }
      console.log("domain\tn\tpack%\tany%\tmiss\tdiverge");
      for (const [d, list] of [...byDomain.entries()].sort()) {
        const c = coverageOf(list);
        console.log(
          `${d}\t${c.n}\t${c.packPct}\t${c.anyPct}\t${c.miss}\t${c.diverge}`,
        );
      }
      const interesting = results.filter((r) =>
        ["MISS", "DIVERGE", "POLICY-HIT", "ATTR", "CASCADE"].includes(r.kind),
      );
      console.log(`# observe rows (not PACK/POLICY): ${interesting.length}`);
      for (const r of interesting) {
        console.log(
          [r.kind, r.domain, r.query, r.pack ?? "null", r.wantPack ?? "null", r.attr, r.hs ?? "-"].join(
            "\t",
          ),
        );
      }
    }
  } else {
    if (fullMode) printSummary("hint-gap-probe --full", results);
    else console.log(`# hint-gap-probe  rows=${results.length}  ${JSON.stringify(counts)}`);
    printTable(results);
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
