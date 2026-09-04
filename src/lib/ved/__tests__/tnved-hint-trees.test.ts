import { describe, expect, it } from "vitest";
import overlay from "../tnved-hint-tree-packs.json";
import {
  hintTreeBestHeading,
  hintTreeFocusCodes,
  hintTreeHeadingForAnswer,
  hintTreeQuestions,
  matchHintPack,
  packSteps,
} from "../tnved-hint-trees";

describe("C21 TNVED hint trees", () => {
  it("packs only point at 2-10 digit headings (attrs-only steps may be empty)", () => {
    expect(overlay.packs.length).toBeGreaterThanOrEqual(12);
    for (const pack of overlay.packs) {
      expect(pack.triggers.length).toBeGreaterThan(0);
      const steps = packSteps(pack as never);
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps.length).toBeLessThanOrEqual(3);
      for (const step of steps) {
        for (const o of step.options) {
          if (!o.hsHeading) continue;
          expect(o.hsHeading).toMatch(/^\d{2,10}$/);
        }
      }
    }
    expect(hintTreeFocusCodes()).toEqual(expect.arrayContaining(["0401", "040210", "040299", "0403"]));
  });

  it("matches milk family and does not invent a pasteurization code", () => {
    expect(matchHintPack("молоко")?.id).toBe("milk");
    const qs = hintTreeQuestions("молоко");
    expect(qs).toHaveLength(2);
    expect(qs[0].id).toBe("tnved-form");
    expect(qs[1].id).toBe("composition");
    const labels = qs[0].options.map((o) => o.label);
    expect(labels.join(" ")).toMatch(/Питьевое/);
    expect(labels.join(" ")).toMatch(/Сухое/);
    expect(labels.join(" ")).toMatch(/Сгущённое/);
    const pasteurized = qs[0].options.find((o) => o.id === "fresh");
    expect(pasteurized?.hsHeading).toBe("0401");
    expect(qs[0].options.every((o) => o.hsHeading !== "pasteurized")).toBe(true);
  });

  it("maps dry milk to 040210 and condensed to 040299", () => {
    const qs = hintTreeQuestions("молоко");
    expect(qs[0].options.find((o) => o.id === "powder")?.hsHeading).toBe("040210");
    expect(qs[0].options.find((o) => o.id === "condensed")?.hsHeading).toBe("040299");
    expect(qs[0].options.find((o) => o.id === "fermented")?.hsHeading).toBe("0403");
  });

  it("does not steal socks from apparel clarify", () => {
    // F5: носки → hosiery pack (was null; category clarify still skipped via skipQuestionIds)
    expect(matchHintPack("носки")?.id).toBe("hosiery");
    expect(hintTreeQuestions("носки")[0].id).toBe("tnved-form");
  });

  it("headgear pack maps кепка to 6505003000", () => {
    expect(matchHintPack("кепка")?.id).toBe("headgear");
    const qs = hintTreeQuestions("кепка");
    expect(qs[0].options.find((o) => o.id === "cap")?.hsHeading).toBe("6505003000");
    expect(qs[0].options.find((o) => o.id === "hat")?.hsHeading).toBe("6505009000");
  });

  it("P2: hintTreeHeadingForAnswer maps produce fork by option id/value/label", () => {
    expect(hintTreeHeadingForAnswer("огурец", "tnved-form", "fresh")).toBe("0707");
    expect(hintTreeHeadingForAnswer("огурец", "tnved-form", "preserved")).toBe("0711");
    expect(hintTreeHeadingForAnswer("огурец", "tnved-form", "prepared")).toBe("2001");
    expect(
      hintTreeHeadingForAnswer("огурец", "tnved-form", "овощи готовые консервы"),
    ).toBe("2001");
    expect(
      hintTreeHeadingForAnswer("огурец", "tnved-form", "Готовые / консервы"),
    ).toBe("2001");
    expect(hintTreeHeadingForAnswer("майка", "tnved-form", "fresh")).not.toBe("0707");
  });

  it("C21b optics: purpose → composition (two steps)", () => {
    expect(matchHintPack("очки")?.id).toBe("optics");
    const qs = hintTreeQuestions("очки");
    expect(qs).toHaveLength(2);
    expect(qs[0].id).toBe("tnved-form");
    expect(qs[1].id).toBe("composition");
    const labels = qs[0].options.map((o) => o.label).join(" ");
    expect(labels).toMatch(/Солнцезащитные/);
    expect(labels).toMatch(/Коррекционные/);
    expect(labels).toMatch(/Линзы/);
    expect(labels).toMatch(/Оправа/);
    expect(qs[0].options.find((o) => o.id === "sun")?.hsHeading).toBe("900410");
    expect(qs[0].options.find((o) => o.id === "corrective")?.hsHeading).toBe("900490");
    expect(qs[0].options.find((o) => o.id === "lenses")?.hsHeading).toBe("9001");
    expect(qs[0].options.find((o) => o.id === "frames")?.hsHeading).toBe("9003");
    expect(qs[1].options.every((o) => !o.hsHeading)).toBe(true);
    expect(hintTreeHeadingForAnswer("очки", "tnved-form", "sun")).toBe("900410");
    expect(
      hintTreeBestHeading("очки", {
        "tnved-form": "солнцезащитные очки",
        composition: "пластик",
      }),
    ).toBe("900410");
  });

  it("C21b headphones: form → composition", () => {
    expect(matchHintPack("наушники")?.id).toBe("headphones");
    const qs = hintTreeQuestions("наушники");
    expect(qs).toHaveLength(2);
    expect(qs[0].options.map((o) => o.id).sort()).toEqual(["earbuds", "headset", "overear"]);
    expect(qs[0].options.every((o) => o.hsHeading === "8518309500")).toBe(true);
    expect(qs[1].id).toBe("composition");
    expect(
      hintTreeBestHeading("наушники", {
        "tnved-form": "наушники-вкладыши",
        composition: "силикон",
      }),
    ).toBe("8518309500");
  });

  it("C21b umbrellas: type fork → composition", () => {
    expect(matchHintPack("зонт")?.id).toBe("umbrellas");
    const qs = hintTreeQuestions("зонт");
    expect(qs).toHaveLength(2);
    expect(qs[0].options.find((o) => o.id === "garden")?.hsHeading).toBe("660110");
    expect(qs[0].options.find((o) => o.id === "telescopic")?.hsHeading).toBe("660191");
    expect(qs[0].options.find((o) => o.id === "other")?.hsHeading).toBe("660199");
    expect(hintTreeHeadingForAnswer("зонт", "tnved-form", "telescopic")).toBe("660191");
    expect(
      hintTreeBestHeading("зонт складной", {
        "tnved-form": "зонт складной телескопический",
        composition: "полиэстер",
      }),
    ).toBe("660191");
  });

  it("C21b lamps: form → composition (not LED pack)", () => {
    expect(matchHintPack("торшер")?.id).toBe("lamps");
    expect(matchHintPack("led лампа")).not.toBe("lamps");
    const qs = hintTreeQuestions("светильник");
    expect(qs).toHaveLength(2);
    expect(qs[0].options.map((o) => o.id).sort()).toEqual(["chandelier", "desk", "floor"]);
    expect(qs[0].options.every((o) => o.hsHeading === "9405")).toBe(true);
  });

  it("C21b security-cam: type → composition; bare камера stays null", () => {
    expect(matchHintPack("камера")).toBeNull();
    expect(matchHintPack("камера видеонаблюдения")?.id).toBe("security-cam");
    const qs = hintTreeQuestions("cctv");
    expect(qs).toHaveLength(2);
    expect(qs[0].options.every((o) => o.hsHeading === "8525")).toBe(true);
    expect(qs[1].id).toBe("composition");
  });

  it("C21b chocolate: form fork → kind", () => {
    expect(matchHintPack("шоколад")?.id).toBe("chocolate");
    const qs = hintTreeQuestions("шоколад");
    expect(qs).toHaveLength(2);
    expect(qs[0].options.find((o) => o.id === "bar")?.hsHeading).toBe("180632");
    expect(qs[0].options.find((o) => o.id === "filled")?.hsHeading).toBe("180631");
    expect(hintTreeBestHeading("шоколад", { "tnved-form": "шоколадная плитка", composition: "молочный шоколад" })).toBe(
      "180632",
    );
  });

  it("C21b cookware: metal HS fork → form", () => {
    expect(matchHintPack("кастрюля")?.id).toBe("cookware");
    const qs = hintTreeQuestions("сковорода");
    expect(qs).toHaveLength(2);
    expect(qs[0].options.find((o) => o.id === "steel")?.hsHeading).toBe("7323");
    expect(qs[0].options.find((o) => o.id === "aluminum")?.hsHeading).toBe("7615");
    expect(qs[1].options.every((o) => !o.hsHeading)).toBe(true);
    expect(
      hintTreeBestHeading("кастрюля", { "tnved-form": "алюминий", composition: "кастрюля" }),
    ).toBe("7615");
  });

  it("C21b tableware: material HS fork → form", () => {
    expect(matchHintPack("тарелка")?.id).toBe("tableware");
    const qs = hintTreeQuestions("чашка");
    expect(qs).toHaveLength(2);
    expect(qs[0].options.find((o) => o.id === "porcelain")?.hsHeading).toBe("6911");
    expect(qs[0].options.find((o) => o.id === "ceramic")?.hsHeading).toBe("6912");
    expect(qs[0].options.find((o) => o.id === "glass")?.hsHeading).toBe("7013");
    expect(qs[1].options.every((o) => !o.hsHeading)).toBe(true);
  });

  it("C21b networking / pet-food / rugs / tires multistep", () => {
    expect(hintTreeQuestions("роутер")).toHaveLength(2);
    expect(hintTreeQuestions("роутер")[0].options.every((o) => o.hsHeading === "8517")).toBe(true);
    expect(hintTreeQuestions("корм для кошек")).toHaveLength(2);
    expect(hintTreeQuestions("корм для кошек")[0].options.every((o) => o.hsHeading === "2309")).toBe(true);
    expect(matchHintPack("ковёр")?.id).toBe("rugs");
    expect(hintTreeHeadingForAnswer("ковёр", "tnved-form", "woven")).toBe("5702");
    expect(hintTreeHeadingForAnswer("шина", "tnved-form", "retread")).toBe("4012");
    expect(hintTreeBestHeading("шины", { "tnved-form": "шины легковые новые", composition: "резина" })).toBe("4011");
  });

  it("hygiene: no catch-all empty «уточнить» options", () => {
    const vague = /уточн|\/\s*другой|прочие\s*\/|другие животные/i;
    const noise: string[] = [];
    for (const pk of overlay.packs) {
      for (const st of packSteps(pk as never)) {
        for (const o of st.options) {
          if (o.hsHeading) continue;
          if (vague.test(`${o.id} ${o.label} ${o.value}`)) {
            noise.push(`${pk.id}/${st.id}/${o.id}:${o.label}`);
          }
        }
      }
    }
    expect(noise).toEqual([]);
    expect(hintTreeQuestions("кастрюля")[0].options.map((o) => o.id).sort()).toEqual(["aluminum", "steel"]);
  });

  it("F1: multistep packs skip category material/dishes leaks", () => {
    expect(matchHintPack("очки")?.skipQuestionIds).toEqual(
      expect.arrayContaining(["composition", "material"]),
    );
    expect(matchHintPack("кастрюля")?.skipQuestionIds).toEqual(
      expect.arrayContaining(["composition", "dishes-material"]),
    );
    expect(matchHintPack("наушники")?.skipQuestionIds).toEqual(
      expect.arrayContaining(["composition", "brand-model"]),
    );
  });

  it("F2: bare оправа → optics frames branch", () => {
    expect(matchHintPack("оправа")?.id).toBe("optics");
    expect(hintTreeQuestions("оправа")).toHaveLength(2);
    expect(hintTreeHeadingForAnswer("оправа", "tnved-form", "frames")).toBe("9003");
    expect(matchHintPack("линза")?.id).not.toBe("optics");
  });

  it("Phase C/E: food+elec residuals + P1 deepen", () => {
    expect(matchHintPack("морс")?.id).toBe("snacks");
    expect(hintTreeQuestions("морс")).toHaveLength(2);
    expect(hintTreeHeadingForAnswer("морс", "tnved-form", "drinks-nonfruit")).toBe("2202");

    expect(matchHintPack("HDD")?.id).toBe("pc-parts");
    expect(matchHintPack("hdd")?.id).toBe("pc-parts");
    expect(hintTreeQuestions("HDD")).toHaveLength(2);

    expect(matchHintPack("hdmi кабель")?.id).toBe("power");
    expect(matchHintPack("провод")).toBeNull();
    expect(hintTreeHeadingForAnswer("hdmi кабель", "tnved-form", "cable")).toMatch(/^8544/);

    for (const q of ["водка", "молоко", "чай", "пиво", "телевизор", "steam deck", "часы"] as const) {
      expect(hintTreeQuestions(q).length, q).toBeGreaterThanOrEqual(2);
    }
  });

  it("auto residual: filters → auto-parts; bare фильтр null", () => {
    expect(matchHintPack("воздушный фильтр")?.id).toBe("auto-parts");
    expect(matchHintPack("маслофильтр")?.id).toBe("auto-parts");
    expect(hintTreeQuestions("воздушный фильтр")).toHaveLength(2);
    expect(hintTreeHeadingForAnswer("воздушный фильтр", "tnved-form", "air-filter")).toBe("842131");
    expect(hintTreeHeadingForAnswer("маслофильтр", "tnved-form", "oil-filter")).toBe("842123");
    expect(matchHintPack("фильтр")).toBeNull();
  });

  it("Phase F: P1 deepen + jewelry 7117 fork + long-tail", () => {
    for (const [q, pack] of [
      ["лыжи", "sports"],
      ["кольцо", "jewelry"],
      ["бампер", "auto-body"],
      ["погрузчик", "forklift-trucks"],
      ["рюкзак", "bags"],
      ["палатка", "camping"],
      ["крем для лица", "cosmetics"],
      ["батарейка", "batteries"],
      ["бижутерия", "jewelry"],
    ] as const) {
      expect(matchHintPack(q)?.id, q).toBe(pack);
      expect(hintTreeQuestions(q).length, q).toBeGreaterThanOrEqual(2);
    }
    expect(hintTreeHeadingForAnswer("бусы", "composition", "costume")).toBe("7117");
    expect(hintTreeBestHeading("бусы", { "tnved-form": "бусы", composition: "бижутерия" })).toBe("7117");
  });
});
