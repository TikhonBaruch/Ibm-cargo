#!/usr/bin/env npx tsx
/**
 * Search false-friend audit (морс/HDD/ноутбук class).
 *
 *   npm run probe:search-ff
 *   npm run probe:search-ff -- --live
 *   npm run probe:search-ff -- --live --fail-on hitch
 *   TEST_API_URL=https://ibm-cargo-phi.vercel.app npm run probe:search-ff -- --live
 *
 * Canon: docs/knowledge/plan-tnved-search-false-friend-audit.md
 */
import dictionaryJson from "../src/lib/ved/__tests__/hint-coverage-probe-dictionary.json";
import {
  resolveTnvedSearchAlias,
} from "../src/lib/ved/tnved-query-match";
import {
  scoreTnvedSearchHit,
  tnvedSearchStems,
  tnvedSearchRowHasWholeWordHit,
} from "../src/lib/ved/tnved";
import { matchClassifyAlias } from "../src/lib/ved/tnved-classify-aliases";
import { matchHintPack, hintTreeQuestions } from "../src/lib/ved/tnved-hint-trees";

type CorpusRow = {
  id: string;
  query: string;
  expectedPrefix: string;
  source: string;
};

type ProbeResult = CorpusRow & {
  kind: "OK" | "HITCH" | "EMPTY" | "SKIP";
  topCode: string | null;
  topTitle: string | null;
  note?: string;
};

const SEEDS: CorpusRow[] = [
  { id: "h5.mors", query: "морс", expectedPrefix: "2202", source: "h5" },
  { id: "h5.hdd", query: "HDD", expectedPrefix: "8471", source: "h5" },
  { id: "h5.notebook", query: "ноутбук", expectedPrefix: "847130", source: "h5" },
  { id: "h5.glasses", query: "очки", expectedPrefix: "9004", source: "h5" },
  { id: "h5.socks", query: "носки", expectedPrefix: "6115", source: "h5" },
  { id: "h5.filter", query: "воздушный фильтр", expectedPrefix: "8421", source: "h5" },
  { id: "h5.bijou", query: "бижутерия", expectedPrefix: "7117", source: "h5" },
  { id: "crit.cap", query: "кепка", expectedPrefix: "6505", source: "critical" },
  { id: "crit.sneakers", query: "кроссовки", expectedPrefix: "6404", source: "critical" },
  { id: "crit.keds", query: "кеды", expectedPrefix: "6404", source: "critical" },
  { id: "crit.milk", query: "молоко", expectedPrefix: "0401", source: "critical" },
  { id: "crit.cucumber", query: "огурец", expectedPrefix: "0707", source: "critical" },
  { id: "crit.ssd", query: "SSD", expectedPrefix: "8471", source: "critical" },
];

/** Offline decoys: query → rows that previously stole top (or look-alikes). */
const DECOYS: Record<
  string,
  Array<{ code: string; titleRu: string; notes?: string | null }>
> = {
  морс: [
    { code: "2501001000", titleRu: "Вода морская и солевые растворы", notes: null },
    { code: "8901901000", titleRu: "Морские", notes: null },
  ],
  HDD: [
    { code: "8517620000", titleRu: "Аппараты для передачи данных", notes: null },
  ],
  ноутбук: [
    {
      code: "4421910000",
      titleRu: "Из бамбука",
      notes: "подставка для размещения и охлаждения ноутбука, планшета",
    },
  ],
  огурец: [
    { code: "0403100000", titleRu: "Йогурт", notes: "йогурт, yogurt" },
  ],
  поло: [
    { code: "0207132000", titleRu: "Половины или четвертины", notes: null },
  ],
};

const args = process.argv.slice(2);
const live = args.includes("--live");
const failOn = (flag("--fail-on") || "").split(",").filter(Boolean);
const format = flag("--format") || "table";

function flag(name: string) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function buildCorpus(): CorpusRow[] {
  const seen = new Set<string>();
  const out: CorpusRow[] = [];
  const push = (row: CorpusRow) => {
    const key = row.query.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };
  for (const s of SEEDS) push(s);
  const dict = dictionaryJson as {
    rows: Array<{
      id: string;
      query: string;
      expected?: { searchPrefix?: string | null };
      live?: boolean;
    }>;
  };
  for (const r of dict.rows) {
    const pref = r.expected?.searchPrefix;
    if (!pref) continue;
    push({
      id: r.id,
      query: r.query,
      // keep `|` alts (e.g. 610|6210); strip other non-digits
      expectedPrefix: pref.replace(/[^\d|]/g, ""),
      source: r.live ? "dict-live" : "dict",
    });
  }
  return out;
}

function digitsPrefix(code: string | null | undefined) {
  return String(code || "").replace(/\D/g, "");
}

/** expectedPrefix may be `2009` or `6403|6404` (any alt). */
function matchesExpected(topDigits: string, expectedPrefix: string) {
  const alts = expectedPrefix
    .split("|")
    .map((p) => p.replace(/\D/g, ""))
    .filter(Boolean);
  if (!alts.length || !topDigits) return false;
  return alts.some((want) => topDigits.startsWith(want));
}

function goodLeaf(prefix: string, query: string) {
  const p = prefix.replace(/\D/g, "");
  const code = (p + "0000000000").slice(0, Math.max(10, p.length));
  return {
    code: code.slice(0, 10),
    titleRu: `эталон для «${query}»`,
    notes: query,
    isLeaf: true,
    level: 10,
  };
}

function offlineProbe(row: CorpusRow): ProbeResult {
  const stems = tnvedSearchStems(row.query);
  const alias = resolveTnvedSearchAlias(row.query);
  const good = goodLeaf(row.expectedPrefix, row.query);
  const decoys = DECOYS[row.query] || [];
  const candidates = [
    good,
    ...decoys.map((d) => ({ ...d, isLeaf: true, level: 10 })),
  ];
  const scored = candidates
    .filter((c) =>
      tnvedSearchRowHasWholeWordHit(c, {
        stems,
        digits: "",
        phrase: row.query,
        aliasPrefix: alias?.codePrefix ?? null,
      }),
    )
    .map((c) => ({
      c,
      score: scoreTnvedSearchHit(c, { stems, digits: "", phrase: row.query }),
    }))
    .sort((a, b) => b.score - a.score || a.c.code.localeCompare(b.c.code));

  const top = scored[0]?.c ?? null;
  const topDigits = digitsPrefix(top?.code);
  const want = row.expectedPrefix;
  if (!top) {
    return { ...row, kind: "EMPTY", topCode: null, topTitle: null, note: "no whole-word hits" };
  }
  if (!matchesExpected(topDigits, want)) {
    return {
      ...row,
      kind: "HITCH",
      topCode: top.code,
      topTitle: top.titleRu,
      note: `offline score winner; alias=${alias?.id ?? "-"}`,
    };
  }
  return {
    ...row,
    kind: "OK",
    topCode: top.code,
    topTitle: top.titleRu,
    note: alias ? `alias=${alias.id}` : undefined,
  };
}

async function liveLogin(base: string) {
  const jar = new Map<string, string>();
  const set = (res: Response) => {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  };
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  set(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: new URLSearchParams({
      csrfToken,
      email: process.env.CLIENT_EMAIL || "client@example.com",
      password: process.env.CLIENT_PASSWORD || "demo1234",
      json: "true",
      callbackUrl: `${base}/cabinet`,
    }),
    redirect: "manual",
  });
  set(loginRes);
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`login ${loginRes.status}`);
  }
  return jar;
}

async function liveSearch(base: string, jar: Map<string, string>, q: string) {
  const ck = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `${base}/api/v1/tnved/search?q=${encodeURIComponent(q)}&limit=5`,
        { headers: { Cookie: ck } },
      );
      if (!res.ok) throw new Error(`search ${res.status}`);
      const data = (await res.json()) as {
        items?: Array<{ code?: string; titleRu?: string }>;
      };
      return data.items || [];
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return [];
}

async function liveProbe(row: CorpusRow, base: string, jar: Map<string, string>): Promise<ProbeResult> {
  const items = await liveSearch(base, jar, row.query);
  const top = items[0] || null;
  const topDigits = digitsPrefix(top?.code);
  const want = row.expectedPrefix;
  if (!top) {
    return { ...row, kind: "EMPTY", topCode: null, topTitle: null };
  }
  if (!matchesExpected(topDigits, want)) {
    const pack = matchHintPack(row.query)?.id ?? null;
    const alias = matchClassifyAlias(row.query)?.alias.code ?? null;
    const qs = hintTreeQuestions(row.query)[0]?.options?.[0]?.hsHeading ?? null;
    return {
      ...row,
      kind: "HITCH",
      topCode: top.code || null,
      topTitle: top.titleRu || null,
      note: `pack=${pack} classify=${alias} packOpt0=${qs}`,
    };
  }
  return {
    ...row,
    kind: "OK",
    topCode: top.code || null,
    topTitle: top.titleRu || null,
  };
}

function printTable(results: ProbeResult[]) {
  console.log("kind\tid\tquery\twant\ttop\ttitle");
  for (const r of results) {
    if (r.kind === "OK" && format === "misses") continue;
    console.log(
      [
        r.kind,
        r.id,
        r.query,
        r.expectedPrefix,
        r.topCode ?? "-",
        (r.topTitle || "").slice(0, 50),
      ].join("\t"),
    );
  }
}

async function main() {
  // side-effect bypass for live
  if (live) await import("./lib/install-vercel-bypass.mjs");

  const corpus = buildCorpus();
  console.log(`# probe-search-false-friends  mode=${live ? "live" : "offline"}  n=${corpus.length}`);

  let results: ProbeResult[] = [];
  if (live) {
    const base = (process.env.TEST_API_URL || "https://ibm-cargo-phi.vercel.app").replace(/\/$/, "");
    console.log(`# base=${base}`);
    const jar = await liveLogin(base);
    for (const row of corpus) {
      try {
        results.push(await liveProbe(row, base, jar));
      } catch (e) {
        results.push({
          ...row,
          kind: "EMPTY",
          topCode: null,
          topTitle: null,
          note: String((e as Error).message || e),
        });
      }
    }
  } else {
    // Offline: seeds + decoy keys only (full dict needs live DB for discovery).
    const offlineRows = corpus.filter(
      (r) => r.source === "h5" || r.source === "critical" || DECOYS[r.query],
    );
    console.log(`# offline subset n=${offlineRows.length}`);
    results = offlineRows.map(offlineProbe);
  }

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.kind] = (counts[r.kind] || 0) + 1;
  console.log(`# counts ${JSON.stringify(counts)}`);

  if (format === "json") {
    console.log(JSON.stringify({ counts, results }, null, 2));
  } else {
    printTable(results);
    const hitches = results.filter((r) => r.kind === "HITCH" || r.kind === "EMPTY");
    if (hitches.length) {
      console.log(`# hitches ${hitches.length}`);
      for (const r of hitches) {
        console.log(`  ${r.kind}\t${r.query}\t→\t${r.topCode}\t${r.note || ""}`);
      }
    }
  }

  const bad = results.filter(
    (r) =>
      (failOn.includes("hitch") && r.kind === "HITCH") ||
      (failOn.includes("empty") && r.kind === "EMPTY") ||
      (failOn.includes("any") && r.kind !== "OK"),
  );
  if (failOn.length && bad.length) {
    console.error(`fail-on: ${bad.length}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
