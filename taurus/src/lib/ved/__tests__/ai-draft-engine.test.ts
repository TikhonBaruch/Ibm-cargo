import { describe, expect, it } from "vitest";
import { buildHeuristicDraft, rankHeuristicCandidates } from "../ai-draft-engine";
import rules from "../ai-draft-rules.json";

type RuleRow = { id: string; hsCode: string; duty: number; confidence: number };

const pack = rules as {
  default: RuleRow;
  rules: RuleRow[];
};

function ruleById(id: string) {
  return pack.rules.find((r) => r.id === id) || pack.default;
}

describe("ai-draft-engine (C3)", () => {
  it("classifies laptop descriptions", () => {
    const d = buildHeuristicDraft({ description: "Игровой ноутбук 16\"", country: "Китай" });
    expect(d.hsCode).toBe("8471 30 000 0");
    expect(d.engine).toBe("heuristic-v1");
    expect(d.confidence).toBeGreaterThan(0.85);
    expect(d.duties.vatPercent).toBe(22);
    expect(d.duties.feeRub).toBe(13_541);
  });

  it("classifies textile", () => {
    const d = buildHeuristicDraft({ description: "Мужские джинсы, хлопок" });
    expect(d.hsCode.startsWith("6203")).toBe(true);
    expect(d.duties.customsDutyPercent).toBe(10);
  });

  it("falls back to generic with lower confidence", () => {
    const d = buildHeuristicDraft({ description: "прочее оборудование xyz" });
    expect(d.confidence).toBeLessThan(0.7);
    expect(d.disclaimer).toMatch(/heuristic-v1/);
  });

  it("golden HS matches shared ai-draft-rules.json (laptop/phone/generic)", () => {
    const laptop = ruleById("laptop");
    const phone = ruleById("phone");
    const generic = pack.default;

    expect(buildHeuristicDraft({ description: "ноутбук MacBook", country: "CN" }).hsCode).toBe(
      laptop.hsCode
    );
    expect(buildHeuristicDraft({ description: "смартфон iPhone" }).hsCode).toBe(phone.hsCode);
    expect(buildHeuristicDraft({ description: "прочее оборудование xyz" }).hsCode).toBe(
      generic.hsCode
    );
    expect(buildHeuristicDraft({ description: "смартфон iPhone" }).duties.customsDutyPercent).toBe(
      phone.duty
    );
  });

  it("ranks top-N heuristic candidates with why (M1.2 / C3)", () => {
    const rows = rankHeuristicCandidates({
      title: "Партия",
      description: "Игровой ноутбук и чехол",
      country: "Китай",
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.hsCode).toBe("8471 30 000 0");
    expect(rows[0]?.why).toMatch(/8471|ноутбук/i);
    expect(rows.every((r) => r.why.length > 0)).toBe(true);
  });
});
