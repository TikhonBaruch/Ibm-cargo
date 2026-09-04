import { matchHintPack, hintTreeQuestions } from "../src/lib/ved/tnved-hint-trees";
import {
  heuristicAttrSuggest,
  attrSuggestIsClarifyOnly,
} from "../src/lib/ved/attr-suggest";
import { classifyTnvedCascade } from "../src/lib/ved/tnved-classify";

const mockDb = {
  tnvedCode: { findUnique: async () => null, findMany: async () => [] },
} as never;

const H5 = [
  { q: "очки", prefix: "9004" },
  { q: "носки", prefix: "6115" },
  { q: "морс", prefix: "2202" },
  { q: "HDD", prefix: "8471" },
  { q: "воздушный фильтр", prefix: "8421" },
  { q: "бижутерия", prefix: "7117", altPrefix: "7113" },
];

const H6 = [
  { q: "очки", wantPack: "optics" },
  { q: "носки", wantPack: "hosiery" },
  { q: "hdmi кабель", wantPack: "power" },
  { q: "плащ", wantPack: "outerwear" },
];

function attrLayer(description: string) {
  const out = heuristicAttrSuggest({ description });
  if (attrSuggestIsClarifyOnly(out)) return "A~";
  if (out.attrs.hsHint) return "A+";
  if (out.attrs.purpose === "уточните назначение товара") return "A0";
  return "A+";
}

async function searchPrefix(q: string) {
  const hit = await classifyTnvedCascade(mockDb, { description: q });
  return hit?.hsCode?.replace(/\D/g, "").slice(0, 4) || "";
}

async function main() {
  console.log("## H5 domain search (cascade top prefix, preview bundle)");
  let h5pass = 0;
  for (const row of H5) {
    const top = await searchPrefix(row.q);
    const ok =
      top.startsWith(row.prefix) ||
      (row.altPrefix && top.startsWith(row.altPrefix));
    console.log(`${ok ? "PASS" : "FAIL"}\t${row.q}\t→\t${top || "-"} (want ${row.prefix}${row.altPrefix ? "/" + row.altPrefix : ""})`);
    if (ok) h5pass++;
  }

  console.log("\n## H6 domain attr-suggest (preview bundle)");
  let h6pass = 0;
  for (const row of H6) {
    const out = heuristicAttrSuggest({ description: row.q });
    const pack = out.attrs.extra?.clarifyPack ?? null;
    const layer = attrLayer(row.q);
    const ok = pack === row.wantPack && layer === "A~";
    console.log(
      `${ok ? "PASS" : "FAIL"}\t${row.q}\tpack=${pack ?? "null"} layer=${layer} (want ${row.wantPack}/A~)`,
    );
    if (ok) h6pass++;
  }

  console.log(`\nH5_OFFLINE ${h5pass}/${H5.length} · H6_OFFLINE ${h6pass}/${H6.length}`);
  process.exit(h5pass === H5.length && h6pass === H6.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
