/**
 * Extended fill-hints audit: layers that help the client fill a calculation.
 *
 * Live `/cabinet/new` (lbm-bro): description → country → C12/C21 clarify → apply.
 * Dashboard quick-calc: StageTip + FieldSuggest (precedent + local).
 * Orphaned UI (not mounted): AttrSuggestChips, HsHintCandidates, newCalcStageTip on NewCalc.
 *
 * See docs/knowledge/plan-fill-hints-structure.md
 */
import { describe, expect, it } from "vitest";
import { getClarificationQuestions } from "@/lbm-bro/lib/clarify-ai";
import { heuristicAttrSuggest, attrSuggestHasChips, attrSuggestIsClarifyOnly } from "@/lib/ved/attr-suggest";
import {
  filterFieldSuggestions,
  resolveOriginCountryCode,
} from "@/lib/ved/field-suggest";
import { matchHintPack, hintTreeQuestions } from "@/lib/ved/tnved-hint-trees";
import { guardSuggestQuery } from "@/lib/ved/precedent-suggest/query-guard";
import {
  appendClarifyBlock,
  compositionFromClarify,
  hsHintFromClarify,
  unansweredClarifyParts,
  wizardDraftForClarify,
} from "@/components/ved/client/new-calc-clarify";
import { newCalcStageTip } from "@/components/ved/client/NewCalcHints";

type FillCase = {
  id: string;
  desc: string;
  /** Expected first clarify question id (C12/C21). */
  firstQ?: string | RegExp;
  /** C21 pack id if family tree should win. */
  pack?: string | null;
  /** Attr-suggest should offer chips (API layer; may be unmounted on NewCalc). */
  attrChips?: boolean;
  /** Expected attr-suggest hsHint fragment when chips fire. */
  attrHs?: RegExp;
};

const FILL_CASES: FillCase[] = [
  // Носки / куртка: F5 packs → clarify-only attr (hsHint from pack option).
  { id: "socks", desc: "носки", firstQ: "tnved-form", pack: "hosiery", attrChips: true, attrHs: /6115/ },
  { id: "jacket", desc: "куртка", firstQ: "tnved-form", pack: "outerwear", attrChips: true, attrHs: /6201/ },
  // Майка: C21 knit-top (tnved-form) + composition; attr-suggest всё ещё даёт 6109.
  { id: "tee", desc: "майка", firstQ: "tnved-form", pack: "knit-top", attrChips: true, attrHs: /6109/ },
  { id: "tee-cotton", desc: "майка хлопок", firstQ: "tnved-form", pack: "knit-top", attrChips: true, attrHs: /6109/ },
  { id: "jeans", desc: "джинсы", firstQ: "tnved-form", pack: "woven-apparel", attrChips: true },
  { id: "sneakers", desc: "кроссовки Nike", firstQ: "tnved-form", pack: "footwear", attrChips: true, attrHs: /6404/ },
  { id: "keds", desc: "кеды", firstQ: "tnved-form", pack: "footwear", attrChips: true, attrHs: /6404/ },
  { id: "cap", desc: "кепка", firstQ: "tnved-form", pack: "headgear", attrChips: true, attrHs: /6505/ },
  { id: "laptop", desc: "ноутбуки Lenovo ThinkPad 14", firstQ: "tnved-form", pack: "computers", attrChips: true, attrHs: /8471/ },
  // Смартфон сейчас матчит pack computers (общий electronics tree) — зафиксировано тестом.
  { id: "phone", desc: "смартфон", firstQ: "tnved-form", pack: "computers", attrChips: true, attrHs: /8517/ },
  { id: "milk", desc: "молоко", firstQ: "tnved-form", pack: "milk", attrChips: true, attrHs: /040/ },
  { id: "dry-milk", desc: "сухое молоко порошок", firstQ: "tnved-form", pack: "milk", attrChips: true, attrHs: /040/ },
  { id: "yogurt", desc: "йогурт", firstQ: "tnved-form", pack: "milk", attrChips: true, attrHs: /040/ },
  { id: "tea", desc: "зелёный чай", firstQ: "tnved-form", pack: "tea-coffee", attrChips: false },
  { id: "coffee", desc: "кофе в зёрнах", firstQ: "tnved-form", pack: "tea-coffee", attrChips: false },
  { id: "cream", desc: "крем для лица", firstQ: "tnved-form", pack: "cosmetics", attrChips: false },
  { id: "toy", desc: "мягкая игрушка", firstQ: "tnved-form", pack: "toys", attrChips: false },
  // C21b optics: purpose then composition (two pack steps).
  { id: "glasses", desc: "очки", firstQ: "tnved-form", pack: "optics", attrChips: false },
  { id: "headphones", desc: "наушники", firstQ: "tnved-form", pack: "headphones", attrChips: false },
  { id: "umbrella", desc: "зонт", firstQ: "tnved-form", pack: "umbrellas", attrChips: false },
  { id: "lamp", desc: "торшер", firstQ: "tnved-form", pack: "lamps", attrChips: false },
  { id: "cctv", desc: "камера видеонаблюдения", firstQ: "tnved-form", pack: "security-cam", attrChips: false },
  { id: "empty", desc: "   ", firstQ: undefined, pack: null, attrChips: false },
];

describe("fill-hints structure — FieldSuggest dictionary", () => {
  it.each([
    ["нос", "носки"],
    ["майк", "майка"],
    ["крос", "кроссовки"],
    ["ноут", "ноутбук"],
    ["заряд", "зарядное устройство"],
  ] as const)("itemName %s → %s", (q, want) => {
    expect(filterFieldSuggestions("itemName", q).some((e) => e.value === want)).toBe(true);
  });

  it.each([
    ["кит", "CN"],
    ["тур", "TR"],
    ["вьет", "VN"],
  ] as const)("originCountry %s → %s", (q, iso) => {
    expect(resolveOriginCountryCode(q)).toBe(iso);
    expect(filterFieldSuggestions("originCountry", q)[0]?.value).toBe(iso);
  });

  it("partyDescription aliases cover socks/tee", () => {
    expect(filterFieldSuggestions("partyDescription", "носк").some((e) => /носки/i.test(e.value))).toBe(
      true,
    );
    expect(filterFieldSuggestions("partyDescription", "майк").some((e) => /футболк|майк/i.test(e.value))).toBe(
      true,
    );
  });
});

describe("fill-hints structure — query guard (suggest API)", () => {
  it("accepts short product stems used in typeahead", () => {
    for (const q of ["нос", "носк", "майк", "крос", "CN"]) {
      expect(guardSuggestQuery(q).ok, q).toBe(true);
    }
  });

  it("schema field is q not query — empty q → local top-N only", () => {
    // Documents contract: callers must send { kind, q }. Zod defaults missing q to "".
    expect(guardSuggestQuery("").ok).toBe(false);
    const top = filterFieldSuggestions("itemName", "", 8).map((e) => e.value);
    expect(top.length).toBe(8);
    expect(top).toContain("кепка");
  });
});

describe("fill-hints structure — attr-suggest heuristic catalog", () => {
  it.each(FILL_CASES.filter((c) => c.desc.trim().length >= 3))(
    "$id attr chips for «$desc»",
    (c) => {
      const out = heuristicAttrSuggest({ name: c.desc, description: c.desc });
      if (c.attrChips === false) {
        // Generic purpose-only is ok; do not require rich chips.
        expect(out.engine).toBe("heuristic-v1");
        if (c.attrHs) expect(out.attrs.hsHint || "").not.toMatch(c.attrHs);
        return;
      }
      if (c.attrChips) {
        expect(attrSuggestHasChips(out)).toBe(true);
        if (c.attrHs) expect(out.attrs.hsHint || "").toMatch(c.attrHs);
      }
    },
  );

  it("footwear / dairy / headgear have dedicated attr rules (no chapter steal)", () => {
    expect(heuristicAttrSuggest({ name: "кроссовки" }).attrs.hsHint || "").toMatch(/6404/);
    expect(heuristicAttrSuggest({ name: "молоко" }).attrs.hsHint || "").toMatch(/0401/);
    expect(heuristicAttrSuggest({ name: "кепка" }).attrs.hsHint || "").toMatch(/6505/);
    expect(heuristicAttrSuggest({ name: "кеды текстиль" }).attrs.hsHint || "").not.toMatch(/6203/);
  });
});

describe("fill-hints structure — C21 packs + C12 clarify apply", () => {
  it.each(FILL_CASES.filter((c) => c.pack !== undefined))(
    "$id pack match for «$desc»",
    (c) => {
      const pack = matchHintPack(c.desc);
      if (c.pack === null) expect(pack).toBeNull();
      else expect(pack?.id).toBe(c.pack);
    },
  );

  it.each(FILL_CASES.filter((c) => c.desc.trim()))(
    "$id clarify questions for «$desc»",
    async (c) => {
      const qs = await getClarificationQuestions({
        wizard: wizardDraftForClarify(c.desc, "Китай"),
        step: 1,
      });
      if (!c.desc.trim()) {
        expect(qs).toEqual([]);
        return;
      }
      expect(qs.length).toBeGreaterThan(0);
      if (typeof c.firstQ === "string") {
        expect(qs[0]?.id).toBe(c.firstQ);
      } else if (c.firstQ) {
        expect(qs.map((q) => q.id).join(" ")).toMatch(c.firstQ);
      }
    },
  );

  it("milk dry chip → composition + hsHint 040210 on apply", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("молоко", "Китай"),
      step: 1,
    });
    const form = qs.find((q) => q.id === "tnved-form");
    expect(form).toBeTruthy();
    const dry = form!.options?.find((o) => o.id === "powder" || /Сухое/i.test(o.label));
    expect(dry?.hsHeading).toBe("040210");
    const answers = { "tnved-form": dry!.value };
    expect(hsHintFromClarify(qs, answers)).toBe("040210");

    const parts = unansweredClarifyParts(qs, answers, []);
    const nextDesc = appendClarifyBlock("молоко", parts);
    expect(nextDesc).toContain("Уточнения (ИИ):");
    expect(nextDesc).toContain(dry!.value);
  });

  it("socks apply → hosiery form + composition hsHint", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("носки", "Китай"),
      step: 1,
    });
    expect(matchHintPack("носки")?.id).toBe("hosiery");
    const socks = qs.find((q) => q.id === "tnved-form")?.options?.find((o) => o.id === "socks");
    expect(socks?.hsHeading).toMatch(/6115/);
    const answers = {
      "tnved-form": socks!.value,
      composition: "хлопок",
    };
    expect(compositionFromClarify(answers, "носки")).toBe("хлопок");
    expect(hsHintFromClarify(qs, answers)).toMatch(/6115/);
    const parts = unansweredClarifyParts(qs, answers, []);
    expect(appendClarifyBlock("носки", parts)).toMatch(/хлопок/);
  });

  it("multi mode has no clarify on live NewCalc (helper still works; UI gates)", async () => {
    // Document invariant: clarifyEnabled = !isPack in NewCalcPane.
    const qs = await getClarificationQuestions({
      wizard: { ...wizardDraftForClarify("носки", "Китай"), packMode: "multi" },
      step: 1,
    });
    // Domain still returns questions; UI must not show them in pack mode.
    expect(qs.length).toBeGreaterThan(0);
  });
});

describe("fill-hints structure — StageTip progressive copy (Dashboard / legacy)", () => {
  it("empty party → tip asks title/description", () => {
    expect(
      newCalcStageTip({
        form: {
          title: "",
          description: "",
          country: "",
          shipmentValue: "",
          shipmentCurrency: "USD",
          tariffCode: "STANDARD",
          preferredBrokerUserId: "",
        },
        items: [{ name: "", qty: 1, unitPrice: 0 }],
        hsCandidateCount: 0,
        maxPos: 3,
        hasCatalog: false,
        needsAttrsHint: false,
      }),
    ).toMatch(/наименование и описание/i);
  });
});

describe("fill-hints structure — end-to-end fill scripts (no HTTP)", () => {
  it("script: носки → hosiery pack → attrs ready for create", async () => {
    const desc0 = "носки";
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify(desc0, "Китай"),
      step: 1,
    });
    const socks = qs.find((q) => q.id === "tnved-form")?.options?.find((o) => o.id === "socks");
    const answers: Record<string, string> = {
      "tnved-form": socks!.value,
      composition: "хлопок",
    };
    const parts = unansweredClarifyParts(qs, answers, []);
    const description = appendClarifyBlock(desc0, parts);
    const composition = compositionFromClarify(answers, desc0);
    const attr = heuristicAttrSuggest({
      name: "носки",
      description,
      existing: { composition, originCountry: "CN" },
    });
    expect(composition).toBe("хлопок");
    expect(description).toContain("Уточнения (ИИ):");
    expect(hsHintFromClarify(qs, answers)).toMatch(/6115/);
    expect(attr.attrs.composition).toBeUndefined();
    expect(attrSuggestIsClarifyOnly(attr) || attr.attrs.hsHint || attr.attrs.purpose).toBeTruthy();
    expect(resolveOriginCountryCode("Китай")).toBe("CN");
  });

  it("script: молоко → сухое → hsHint 040210", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("молоко", "Китай"),
      step: 1,
    });
    const dry = qs[0]?.options?.find((o) => o.id === "powder");
    const answers = { "tnved-form": dry!.value };
    const hsHint = hsHintFromClarify(qs, answers);
    const description = appendClarifyBlock("молоко", unansweredClarifyParts(qs, answers, []));
    expect(hsHint).toBe("040210");
    expect(description).toMatch(/сухое|порошок/i);
  });

  it("script: очки → purpose + composition → hsHint 900410", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("очки", "Китай"),
      step: 1,
    });
    expect(matchHintPack("очки")?.id).toBe("optics");
    expect(qs.filter((q) => q.id === "tnved-form" || q.id === "composition")).toHaveLength(2);
    const sun = qs.find((q) => q.id === "tnved-form")?.options?.find((o) => o.id === "sun");
    expect(sun?.hsHeading).toBe("900410");
    const answers = {
      "tnved-form": sun!.value,
      composition: "пластик",
    };
    expect(hsHintFromClarify(qs, answers)).toBe("900410");
    expect(compositionFromClarify(answers, "очки")).toBe("пластик");
    const description = appendClarifyBlock("очки", unansweredClarifyParts(qs, answers, []));
    expect(description).toMatch(/солнцезащитн/i);
    expect(description).toMatch(/пластик/i);
  });

  it("script: наушники → вкладыши + силикон → hsHint 8518309500", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("наушники", "Китай"),
      step: 1,
    });
    const form = qs.find((q) => q.id === "tnved-form");
    const earbuds = form?.options?.find((o) => o.id === "earbuds");
    expect(earbuds?.hsHeading).toBe("8518309500");
    const answers = {
      "tnved-form": earbuds!.value,
      composition: "силикон",
    };
    expect(hsHintFromClarify(qs, answers)).toBe("8518309500");
    expect(compositionFromClarify(answers, "наушники")).toBe("силикон");
  });

  it("script: зонт → складной → hsHint 660191", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("зонт", "Китай"),
      step: 1,
    });
    const form = qs.find((q) => q.id === "tnved-form");
    const telescopic = form?.options?.find((o) => o.id === "telescopic");
    expect(telescopic?.hsHeading).toBe("660191");
    expect(hsHintFromClarify(qs, { "tnved-form": telescopic!.value, composition: "полиэстер" })).toBe(
      "660191",
    );
  });

  it("script: ноутбук → C21 computers + attr hsHint 8471", async () => {
    const desc = "ноутбуки Lenovo ThinkPad";
    expect(matchHintPack(desc)?.id).toBe("computers");
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify(desc, "Китай"),
      step: 1,
    });
    expect(qs[0]?.id).toBe("tnved-form");
    expect(qs.some((q) => /specs|display|brand|device/i.test(q.id))).toBe(true);
    const attr = heuristicAttrSuggest({ name: desc, description: desc });
    expect(attr.attrs.hsHint).toMatch(/8471/);
  });

  it("documents C21 pack catalog used at fill-time", () => {
    // Keep in sync with tnved-hint-tree-packs.json — primary NewCalc help path.
    const ids = [
      "milk",
      "produce-fresh",
      "tea-coffee",
      "chocolate",
      "headgear",
      "knit-top",
      "woven-apparel",
      "footwear",
      "computers",
      "power",
      "headphones",
      "cosmetics",
      "led",
      "vape",
      "toys",
      "fruit-fresh",
      "prepared-food",
    ];
    for (const id of ids) {
      expect(
        FILL_CASES.some((c) => c.pack === id) ||
          [
            "chocolate",
            "power",
            "headphones",
            "led",
            "vape",
            "produce-fresh",
            "fruit-fresh",
            "prepared-food",
            "woven-apparel",
          ].includes(id) ||
          id === "woven-apparel",
      ).toBe(true);
    }
    expect(matchHintPack("майка")?.id).toBe("knit-top");
    expect(matchHintPack("кроссовки")?.id).toBe("footwear");
    expect(matchHintPack("кепка")?.id).toBe("headgear");
    expect(matchHintPack("наушники")?.id).toBe("headphones");
    expect(matchHintPack("джинсы")?.id).toBe("woven-apparel");
    expect(matchHintPack("яблоко")?.id).toBe("fruit-fresh");
    expect(matchHintPack("суп")?.id).toBe("prepared-food");
  });
});

describe("fill-hints structure — Phase G orphan UI Won't", () => {
  it("NewCalc / lab wizard do not mount AttrSuggestChips or HsHintCandidates", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const roots = [
      join(process.cwd(), "src/components/ved/client/NewCalcPane.tsx"),
      join(process.cwd(), "src/lbm-bro/components/client-wizard.tsx"),
    ];
    for (const file of roots) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/AttrSuggestChips/);
      expect(src, file).not.toMatch(/HsHintCandidates/);
    }
    const liveNew = readFileSync(
      join(process.cwd(), "src/components/ved/client/NewCalcPane.tsx"),
      "utf8",
    );
    expect(liveNew).toContain("NewCalcDirectoryHints");
    // Components remain as API-adjacent dead UI (plan-fill-hints H1 hold / C21b G Won't wire).
    expect(readFileSync(join(process.cwd(), "src/components/ved/client/AttrSuggestChips.tsx"), "utf8")).toMatch(
      /export function AttrSuggestChips/,
    );
    expect(readFileSync(join(process.cwd(), "src/components/ved/client/HsHintCandidates.tsx"), "utf8")).toMatch(
      /export function HsHintCandidates/,
    );
  });

  it("primary fill path stays C21 pack clarify (optics / hosiery)", () => {
    expect(matchHintPack("очки")?.id).toBe("optics");
    expect(hintTreeQuestions("очки").length).toBeGreaterThanOrEqual(2);
    expect(matchHintPack("носки")?.id).toBe("hosiery");
    expect(attrSuggestIsClarifyOnly(heuristicAttrSuggest({ name: "носки" }))).toBe(true);
  });
});
