/**
 * C21 noisy-query branch quality probe (real matchHintPack + clarify merge).
 *   npx tsx scripts/c21-noisy-branch-probe.ts
 */
import { writeFileSync } from "node:fs";
import { matchHintPack, hintTreeQuestions, hintTreeBestHeading } from "../src/lib/ved/tnved-hint-trees";
import { getClarificationQuestions } from "../src/lbm-bro/lib/clarify-ai";
import {
  wizardDraftForClarify,
  hsHintFromClarify,
  compositionFromClarify,
} from "../src/components/ved/client/new-calc-clarify";

type Case = {
  id: string;
  query: string;
  wantPack?: string | null;
  wantPackNot?: string;
  wantSteps?: number;
  branch?: Record<string, string>;
  apply?: Record<string, string>;
  wantHs?: string;
  wantComp?: string;
  note?: string;
  /** known gap — counted separately, not as hard fail */
  soft?: boolean;
};

const cases: Case[] = [
  {
    id: "N01",
    query: "очки",
    wantPack: "optics",
    wantSteps: 2,
    branch: { sun: "900410", corrective: "900490", lenses: "9001", frames: "9003" },
    apply: { "tnved-form": "солнцезащитные очки", composition: "пластик" },
    wantHs: "900410",
    wantComp: "пластик",
  },
  {
    id: "N02",
    query: "солнечные очки",
    wantPack: "optics",
    wantSteps: 2,
    apply: { "tnved-form": "солнцезащитные очки", composition: "металл" },
    wantHs: "900410",
  },
  {
    id: "N03",
    query: "наушники",
    wantPack: "headphones",
    wantSteps: 2,
    apply: { "tnved-form": "наушники-вкладыши", composition: "силикон" },
    wantHs: "8518309500",
  },
  {
    id: "N04",
    query: "зонт",
    wantPack: "umbrellas",
    wantSteps: 2,
    branch: { garden: "660110", telescopic: "660191", other: "660199" },
    apply: { "tnved-form": "зонт складной телескопический", composition: "полиэстер" },
    wantHs: "660191",
  },
  {
    id: "N05",
    query: "лампа",
    wantPack: "lamps",
    wantSteps: 2,
    apply: { "tnved-form": "лампа настольная", composition: "металл" },
    wantHs: "9405",
  },
  { id: "N06", query: "led лампа", wantPackNot: "lamps", note: "LED ≠ furniture lamps" },
  { id: "N07", query: "лампочка", wantPack: "led" },
  { id: "N08", query: "камера", wantPack: null, note: "bare POLICY" },
  {
    id: "N09",
    query: "камера видеонаблюдения",
    wantPack: "security-cam",
    wantSteps: 2,
    apply: { "tnved-form": "камера видеонаблюдения внутренняя", composition: "пластик" },
    wantHs: "8525",
  },
  {
    id: "N10",
    query: "шоколад",
    wantPack: "chocolate",
    wantSteps: 2,
    branch: { bar: "180632", filled: "180631", "other-choc": "180690" },
    apply: { "tnved-form": "шоколадная плитка", composition: "молочный шоколад" },
    wantHs: "180632",
  },
  {
    id: "N11",
    query: "кастрюля",
    wantPack: "cookware",
    wantSteps: 2,
    apply: { "tnved-form": "алюминий", composition: "кастрюля" },
    wantHs: "7615",
  },
  {
    id: "N12",
    query: "сковорода",
    wantPack: "cookware",
    wantSteps: 2,
    apply: { "tnved-form": "сталь", composition: "сковорода" },
    wantHs: "7323",
  },
  {
    id: "N13",
    query: "тарелка",
    wantPack: "tableware",
    wantSteps: 2,
    apply: { "tnved-form": "керамика", composition: "тарелка" },
    wantHs: "6912",
  },
  { id: "N14", query: "посуда", wantPack: "tableware", wantSteps: 2, note: "ambiguous vs cookware" },
  {
    id: "N15",
    query: "роутер",
    wantPack: "networking",
    wantSteps: 2,
    apply: { "tnved-form": "роутер", composition: "пластик" },
    wantHs: "8517",
  },
  {
    id: "N16",
    query: "корм для кошек",
    wantPack: "pet-food",
    wantSteps: 2,
    apply: { "tnved-form": "сухой корм для животных", composition: "для кошек" },
    wantHs: "2309",
  },
  {
    id: "N17",
    query: "ковёр",
    wantPack: "rugs",
    wantSteps: 2,
    apply: { "tnved-form": "ковёр тафтинговый", composition: "шерсть" },
    wantHs: "5703",
  },
  { id: "N18", query: "коврик", wantPack: "rugs", wantSteps: 2 },
  { id: "N19", query: "коврик йога", wantPack: "sports", note: "must not rugs" },
  {
    id: "N20",
    query: "шина",
    wantPack: "tires",
    wantSteps: 2,
    apply: { "tnved-form": "шины легковые новые", composition: "резина" },
    wantHs: "4011",
  },
  { id: "N21", query: "колесо", wantPack: "tires", wantSteps: 2, note: "noisy wheel→tires" },
  { id: "N22", query: "провод", wantPack: null },
  { id: "N23", query: "фильтр", wantPack: null },
  { id: "N24", query: "свеча", wantPack: null },
  { id: "N25", query: "перец", wantPack: null },
  { id: "N26", query: "ореховое молоко", wantPack: null, note: "plant dairy" },
  { id: "N27", query: "носки", wantPack: "hosiery", wantSteps: 2, note: "F5 apparel" },
  { id: "N28", query: "куртка", wantPack: "outerwear", wantSteps: 2, note: "F5 apparel" },
  { id: "N29", query: "торшер", wantPack: "lamps", wantSteps: 2 },
  { id: "N30", query: "веб-камера", wantPackNot: "security-cam", note: "webcam ≠ cctv" },
  { id: "N31", query: "chocolate bar", wantPack: "chocolate", wantSteps: 2 },
  { id: "N32", query: "посудомоечная машина", wantPackNot: "tableware" },
  {
    id: "N33",
    query: "оправа",
    wantPack: "optics",
    wantSteps: 2,
  },
  { id: "N33b", query: "оправа очков", wantPack: "optics", wantSteps: 2 },
  { id: "N34", query: "линзы для очков", wantPack: "optics", wantSteps: 2 },
  { id: "N35", query: "модем", wantPack: "networking", wantSteps: 2 },
  { id: "N36", query: "морс", wantPack: "snacks", wantSteps: 2, note: "Phase C food" },
  { id: "N37", query: "HDD", wantPack: "pc-parts", wantSteps: 2, note: "Phase E elec" },
  { id: "N38", query: "hdmi кабель", wantPack: "power", wantSteps: 2, note: "Phase E elec" },
  { id: "N39", query: "водка", wantPack: "spirits", wantSteps: 2, note: "Phase C deepen" },
  { id: "N40", query: "телевизор", wantPack: "displays", wantSteps: 2, note: "Phase E deepen" },
  { id: "N41", query: "воздушный фильтр", wantPack: "auto-parts", wantSteps: 2, note: "auto residual" },
  { id: "N42", query: "маслофильтр", wantPack: "auto-parts", wantSteps: 2, note: "auto residual" },
  { id: "N43", query: "фильтр", wantPack: null, note: "bare POLICY" },
  { id: "N44", query: "лыжи", wantPack: "sports", wantSteps: 2, note: "Phase F P1" },
  { id: "N45", query: "кольцо", wantPack: "jewelry", wantSteps: 2, note: "Phase F P1" },
  { id: "N46", query: "бампер", wantPack: "auto-body", wantSteps: 2, note: "Phase F P1" },
  { id: "N47", query: "погрузчик", wantPack: "forklift-trucks", wantSteps: 2, note: "Phase F P1" },
  { id: "N48", query: "бижутерия", wantPack: "jewelry", wantSteps: 2, note: "Phase F long-tail" },
  { id: "N49", query: "рюкзак", wantPack: "bags", wantSteps: 2, note: "Phase F long-tail" },
  { id: "N50", query: "палатка", wantPack: "camping", wantSteps: 2, note: "Phase F long-tail" },
];

async function main() {
  const rows = [];
  for (const c of cases) {
    const pack = matchHintPack(c.query);
    const packId = pack?.id ?? null;
    const packQs = hintTreeQuestions(c.query);
    const issues: string[] = [];

    if (c.wantPack !== undefined && packId !== c.wantPack) {
      issues.push(`wantPack ${c.wantPack} got ${packId}`);
    }
    if (c.wantPackNot && packId === c.wantPackNot) issues.push(`STEAL ${c.wantPackNot}`);
    if (c.wantSteps != null && packQs.length !== c.wantSteps) {
      issues.push(`packSteps ${packQs.length}!=${c.wantSteps}`);
    }

    if (packQs[0]?.options.every((o) => !o.hsHeading)) issues.push("step0_all_empty_hs");

    for (const st of packQs) {
      for (const o of st.options) {
        if (!o.hsHeading && /уточн|прочие\s*\/|\/\s*другой/i.test(o.label)) {
          issues.push(`noise:${o.label}`);
        }
      }
    }

    if (c.branch && packQs[0]) {
      for (const [oid, hs] of Object.entries(c.branch)) {
        const hit = packQs[0].options.find((o) => o.id === oid);
        if (!hit) issues.push(`missing:${oid}`);
        else if (hit.hsHeading !== hs) issues.push(`branch ${oid} ${hit.hsHeading}!=${hs}`);
      }
    }

    let applyHs: string | null = null;
    let applyComp: string | null = null;
    let clarifyIds: string[] = [];
    let catLeak = false;

    if (c.apply || packId) {
      const qs = await getClarificationQuestions({
        wizard: wizardDraftForClarify(c.query, "Китай"),
        step: 1,
      });
      clarifyIds = qs.map((q) => q.id);
      // category composition should be skipped when pack has composition step
      if (packQs.some((q) => q.id === "composition") && clarifyIds.filter((id) => id === "composition").length > 1) {
        issues.push("dup_composition_question");
        catLeak = true;
      }
      // category material/device alongside pack composition = UX noise (F1)
      if (packQs.some((q) => q.id === "composition")) {
        const leakIds = ["material", "dishes-material", "device", "brand-model", "packaging", "specs", "origin", "cert"];
        if (clarifyIds.some((id) => leakIds.includes(id))) catLeak = true;
      }
      if (c.apply) {
        applyHs = hsHintFromClarify(qs, c.apply) || hintTreeBestHeading(c.query, c.apply);
        applyComp = compositionFromClarify(c.apply, "");
        if (c.wantHs && applyHs !== c.wantHs) issues.push(`applyHs ${applyHs}!=${c.wantHs}`);
        if (c.wantComp && applyComp !== c.wantComp) issues.push(`comp ${applyComp}!=${c.wantComp}`);
      }
    }

    const hsSet = new Set(packQs[0]?.options.map((o) => o.hsHeading).filter(Boolean) || []);
    const forkKind =
      packQs.length >= 2
        ? hsSet.size >= 2
          ? "deep_fork+comp"
          : "same_hs+comp"
        : packId
          ? hsSet.size >= 2
            ? "deep_fork"
            : "single"
          : "none";

    const hardFail = issues.length > 0 && !c.soft;
    const softFail = issues.length > 0 && !!c.soft;

    rows.push({
      id: c.id,
      query: c.query,
      pack: packId,
      packSteps: packQs.length,
      clarifyIds,
      catLeak,
      forkKind,
      applyHs,
      applyComp,
      ok: !hardFail,
      softFail,
      issues,
      note: c.note || "",
    });
  }

  const pass = rows.filter((r) => r.ok && !r.softFail).length;
  const fail = rows.filter((r) => !r.ok);
  const soft = rows.filter((r) => r.softFail);
  const leaks = rows.filter((r) => r.catLeak);
  const summary = {
    asOf: new Date().toISOString().slice(0, 10),
    total: rows.length,
    pass,
    fail: fail.length,
    soft: soft.length,
    categoryLeaks: leaks.length,
    passRate: `${((pass / rows.length) * 100).toFixed(1)}%`,
    byFork: rows.reduce(
      (a, r) => {
        a[r.forkKind] = (a[r.forkKind] || 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    ),
    fails: fail,
    softFails: soft,
    leakSamples: leaks.slice(0, 8).map((r) => ({ id: r.id, query: r.query, clarifyIds: r.clarifyIds })),
    rows,
  };

  writeFileSync(
    ".tmp-fts-scan/c21-noisy-branch-report.json",
    JSON.stringify(summary, null, 2) + "\n",
  );

  console.log("# C21 noisy branch probe (real modules)");
  console.log(
    JSON.stringify(
      {
        total: summary.total,
        pass: summary.pass,
        fail: summary.fail,
        soft: summary.soft,
        categoryLeaks: summary.categoryLeaks,
        passRate: summary.passRate,
        byFork: summary.byFork,
      },
      null,
      2,
    ),
  );
  console.log("\n# HARD FAILS");
  for (const r of fail) {
    console.log(`${r.id}\t${r.query}\tpack=${r.pack}\t${r.issues.join("; ")}\t${r.note}`);
  }
  console.log("\n# SOFT (known gaps)");
  for (const r of soft) {
    console.log(`${r.id}\t${r.query}\tpack=${r.pack}\t${r.issues.join("; ")}\t${r.note}`);
  }
  console.log("\n# CATEGORY LEAKS (F1)");
  for (const r of leaks.slice(0, 12)) {
    console.log(`${r.id}\t${r.query}\t[${r.clarifyIds.join(",")}]`);
  }
  console.log("\n# MATRIX");
  for (const r of rows) {
    const mark = r.softFail ? "SOFT" : r.ok ? "OK" : "FAIL";
    console.log(
      `${mark}\t${r.id}\t${r.query}\t${r.pack ?? "null"}\t${r.forkKind}\tpackQs=${r.packSteps}\tclarify=[${r.clarifyIds.join(",") || "-"}]\ths=${r.applyHs ?? "-"}`,
    );
  }

  if (fail.length > 0) process.exit(1);
  if (leaks.length > 0) {
    console.error(`\n# GATE FAIL: ${leaks.length} category leaks (F1)`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
