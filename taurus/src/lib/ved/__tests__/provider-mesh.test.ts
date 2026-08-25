import { describe, expect, it } from "vitest";
import {
  resolveTnvedPrefixHint,
  scoreTnvedCandidate,
  tokenizeForTnvedSearch,
} from "../provider-mesh";

describe("provider-mesh Tnved candidate hints", () => {
  it("maps футболка to 6109 even with повседневной носки", () => {
    const text =
      "Женская футболка трикотажная 100% хлопок для повседневной носки, новая, в упаковке";
    expect(resolveTnvedPrefixHint(text)).toBe("6109");
  });

  it("does not tokenize ambiguous носки / noise", () => {
    const tokens = tokenizeForTnvedSearch(
      "Футболка женская для повседневной носки новая в упаковке E2E-MESH-1"
    );
    expect(tokens).not.toContain("носки");
    expect(tokens).not.toContain("новая");
    expect(tokens).not.toContain("упаковке");
    expect(tokens.some((t) => /футболк/i.test(t))).toBe(true);
  });

  it("maps laptop synonym to 847130", () => {
    expect(resolveTnvedPrefixHint("Игровой ноутбук 16 дюймов")).toBe("847130");
  });

  it("maps smartphone to 851713 before generic phone", () => {
    expect(resolveTnvedPrefixHint("Смартфон Android 6.7")).toBe("851713");
  });

  it("prefers footwear sports heading 6404 over broad textile", () => {
    expect(
      resolveTnvedPrefixHint(
        "Обувь спортивная кроссовки, верх текстиль, подошва резина, для повседневной носки"
      )
    ).toBe("6404");
  });

  it("maps LED bulb to 853952", () => {
    expect(resolveTnvedPrefixHint("Лампа светодиодная LED E27 10Вт")).toBe("853952");
  });
});

describe("scoreTnvedCandidate 10-digit leaves", () => {
  const sneakersText =
    "Кроссовки спортивные мужские, верх текстиль, подошва резина, для тенниса и бега";

  it("ranks 6404110000 above protective-toe 6401 for sneakers", () => {
    const sports = scoreTnvedCandidate(
      sneakersText,
      {
        code: "6404110000",
        titleRu:
          "спортивная обувь; обувь для тенниса, баскетбола, гимнастики, тренировочная и аналогичная обувь",
      },
      "6404"
    );
    const toe = scoreTnvedCandidate(
      sneakersText,
      { code: "6401100000", titleRu: "обувь с защитным металлическим подноском" },
      "6404"
    );
    expect(sports).toBeGreaterThan(toe);
  });

  it("ranks cotton t-shirt leaf 6109100000 highest among 6109", () => {
    const cotton = scoreTnvedCandidate(
      "Футболка женская 100% хлопок трикотаж",
      { code: "6109100000", titleRu: "из хлопчатобумажной пряжи" },
      "6109"
    );
    const other = scoreTnvedCandidate(
      "Футболка женская 100% хлопок трикотаж",
      { code: "6109909000", titleRu: "прочие" },
      "6109"
    );
    expect(cotton).toBeGreaterThan(other);
  });

  it("ranks smartphone 8517130000 over other 8517", () => {
    const phone = scoreTnvedCandidate(
      "Смартфон Android с сенсорным экраном",
      { code: "8517130000", titleRu: "смартфоны" },
      "851713"
    );
    const other = scoreTnvedCandidate(
      "Смартфон Android с сенсорным экраном",
      { code: "8517120000", titleRu: "телефоны для сотовых сетей связи" },
      "851713"
    );
    expect(phone).toBeGreaterThan(other);
  });

  it("ranks portable computer 8471300000 for laptop", () => {
    const laptop = scoreTnvedCandidate(
      "Ноутбук портативная вычислительная машина 16 дюймов клавиатура дисплей",
      {
        code: "8471300000",
        titleRu:
          "машины вычислительные портативные массой не более 10 кг, состоящие из центрального блока, клавиатуры и дисплея",
      },
      "847130"
    );
    const other = scoreTnvedCandidate(
      "Ноутбук портативная вычислительная машина 16 дюймов клавиатура дисплей",
      { code: "8471410000", titleRu: "прочие вычислительные машины" },
      "847130"
    );
    expect(laptop).toBeGreaterThan(other);
  });
});
