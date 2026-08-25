/**
 * FNS TNVED TXT parser + demo-pack slice (opendata card slices 0–1).
 */
import { describe, expect, it } from "vitest";
import {
  parseTnved2Text,
  parseTnved3Text,
  parseTnved4Text,
  parseFnsDumpTexts,
  buildDemoPack,
  stripLeadingDashes,
  parseRuDate,
  synonymsForCode,
  selectDemoLeafCodes,
} from "../tnved-fns";

const TNVED2 = `002|20260427|0000|
16|84|РЕАКТОРЫ ЯДЕРНЫЕ, КОТЛЫ, ОБОРУДОВАНИЕ|Примечание: группа 84.|01.01.2022|
12|64|ОБУВЬ, ГЕТРЫ И АНАЛОГИЧНЫЕ ИЗДЕЛИЯ|примечания группы 64|01.01.2022|
`;

const TNVED3 = `002|20260427|0000|
84|71|ВЫЧИСЛИТЕЛЬНЫЕ МАШИНЫ И ИХ БЛОКИ|01.01.2022|
64|04|ОБУВЬ С ПОДОШВОЙ ИЗ РЕЗИНЫ, ПЛАСТМАССЫ|01.01.2022|
`;

const TNVED4 = `004|20260427|0000|
84|71|300000|- машины вычислительные портативные массой не более 10 кг, состоящие из ЦП|01.01.2022|
84|71|300000|УСТАРЕВШЕЕ ИМЯ НОУТБУК|01.01.2002|31.12.2006|
64|04|110000|- - спортивная обувь; обувь для тенниса, баскетбола, гимнастики|01.01.2022|
64|04|199000|- - - прочая|01.01.2022|
`;

describe("FNS TNVED parser", () => {
  it("parses RU dates and treats empty validTo as current", () => {
    expect(parseRuDate("01.01.2022")).toBe("2022-01-01");
    expect(parseRuDate("")).toBeNull();
  });

  it("reads groups / headings / current leaves only", () => {
    const groups = parseTnved2Text(TNVED2);
    const headings = parseTnved3Text(TNVED3);
    const leaves = parseTnved4Text(TNVED4);
    expect(groups.filter((r) => r.current).map((r) => r.code)).toEqual(["84", "64"]);
    expect(headings.filter((r) => r.current)[0]).toMatchObject({
      code: "8471",
      titleRu: "ВЫЧИСЛИТЕЛЬНЫЕ МАШИНЫ И ИХ БЛОКИ",
    });
    const current = leaves.filter((r) => r.current);
    expect(current).toHaveLength(3);
    expect(current.find((r) => r.code === "8471300000")?.titleRu).toMatch(/портативн/i);
    expect(current.find((r) => r.code === "8471300000")?.titleRu).not.toMatch(/УСТАРЕВШЕЕ/);
  });

  it("builds ancestors with official titles, not Позиция ТН ВЭД stubs", () => {
    const nodes = parseFnsDumpTexts({ tnved2: TNVED2, tnved3: TNVED3, tnved4: TNVED4 });
    const by = Object.fromEntries(nodes.map((n) => [n.code, n]));
    expect(by["84"].titleRu).toMatch(/РЕАКТОРЫ ЯДЕРНЫЕ/);
    expect(by["8471"].titleRu).toMatch(/ВЫЧИСЛИТЕЛЬНЫЕ МАШИНЫ/);
    expect(by["847130"].isLeaf).toBe(false);
    expect(by["847130"].titleRu).not.toMatch(/Позиция ТН ВЭД/);
    expect(by["8471300000"].isLeaf).toBe(true);
    expect(by["8471300000"].titleRu).toMatch(/портативн/i);
    expect(nodes.every((n) => !/Позиция ТН ВЭД/i.test(n.titleRu))).toBe(true);
  });

  it("demo-pack keeps official leaf title and puts synonyms in notes", () => {
    const nodes = parseFnsDumpTexts({ tnved2: TNVED2, tnved3: TNVED3, tnved4: TNVED4 });
    const pack = buildDemoPack(nodes);
    const laptop = pack.items.find((i) => i.code === "8471300000");
    const shoes = pack.items.find((i) => i.code === "6404110000");
    expect(laptop?.titleRu).toMatch(/портативн/i);
    expect(laptop?.titleRu).not.toMatch(/ноутбук/i);
    expect(laptop?.notes).toMatch(/ноутбук/i);
    expect(laptop?.rate?.vatPct).toBe(22);
    expect(laptop?.rate?.dutyPct).toBeNull();
    expect(shoes?.notes).toMatch(/кроссовки/i);
    expect(pack.leafCount).toBeGreaterThanOrEqual(2);
    expect(pack.items.some((i) => i.level === 2 && i.code === "84")).toBe(true);
  });

  it("strips HS dash prefixes and maps prefix synonyms", () => {
    expect(stripLeadingDashes("- - спортивная обувь")).toBe("спортивная обувь");
    expect(synonymsForCode("6404110000")).toMatch(/кроссовки/);
    expect(
      selectDemoLeafCodes([
        { code: "8471300000", titleRu: "портативные" },
        { code: "8539511012", titleRu: "для гражданских воздушных судов" },
        { code: "8539520009", titleRu: "прочие LED" },
      ])
    ).toContain("8471300000");
  });
});
