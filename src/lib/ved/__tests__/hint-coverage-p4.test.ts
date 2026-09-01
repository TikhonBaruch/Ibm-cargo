/**
 * Coverage P4: pharma / books / appliances / lamps / fasteners / paint / pet-food / agri-inputs.
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("coverage P4 — open sections after P3", () => {
  it.each([
    ["лекарство", "pharma"],
    ["витамины", "pharma"],
    ["таблетки", "pharma"],
    ["книга", "books"],
    ["тетрадь", "books"],
    ["учебник", "books"],
    ["пылесос", "appliances"],
    ["холодильник", "appliances"],
    ["стиральная машина", "appliances"],
    ["утюг", "appliances"],
    ["микроволновка", "appliances"],
    ["светильник", "lamps"],
    ["люстра", "lamps"],
    ["лампа настольная", "lamps"],
    ["гвозди", "fasteners"],
    ["шуруп", "fasteners"],
    ["краска", "paint"],
    ["обои", "paint"],
    ["корм для кошек", "pet-food"],
    ["корм для собак", "pet-food"],
    ["семена", "agri-inputs"],
    ["удобрение", "agri-inputs"],
    ["гербицид", "agri-inputs"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("steal guards across P4", () => {
    expect(matchHintPack("ноутбук")?.id).toBe("computers");
    expect(matchHintPack("notebook")?.id).toBe("computers");
    expect(matchHintPack("картина")?.id).toBe("art");
    expect(matchHintPack("led лента")?.id).toBe("led");
    expect(matchHintPack("шина")?.id).toBe("tires");
    expect(matchHintPack("наушники")?.id).toBe("headphones");
  });

  it("POLICY: кот / собака remain null (live animals)", () => {
    expect(matchHintPack("кот")).toBeNull();
    expect(matchHintPack("собака")).toBeNull();
  });
});
