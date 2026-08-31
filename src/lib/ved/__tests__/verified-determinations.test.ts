import { describe, it, expect } from "vitest";
import {
  buildCanonicalText,
  buildFingerprint,
  listSimilarPrecedents,
  PRECEDENT_MATCH_THRESHOLD,
} from "../verified-determinations";

describe("verified-determinations", () => {
  it("buildCanonicalText normalizes and merges fields", () => {
    const t = buildCanonicalText({
      name: "MacBook Pro 14",
      description: "Ноутбук Apple",
      attrs: { brand: "Apple", purpose: "ноутбук" },
    });
    expect(t).toContain("macbook");
    expect(t).toContain("apple");
    expect(t).toContain("ноутбук");
  });

  it("buildFingerprint is stable for same input", () => {
    const input = {
      name: "iPhone 15 Pro",
      description: "Смартфон",
      attrs: { brand: "Apple" },
    };
    expect(buildFingerprint(input)).toBe(buildFingerprint(input));
  });

  it("different products get different fingerprints", () => {
    const a = buildFingerprint({ name: "MacBook" });
    const b = buildFingerprint({ name: "iPhone" });
    expect(a).not.toBe(b);
  });

  it("threshold default is reasonable", () => {
    expect(PRECEDENT_MATCH_THRESHOLD).toBeGreaterThanOrEqual(0.5);
    expect(PRECEDENT_MATCH_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it("buildCanonicalText includes composition color and age", () => {
    const t = buildCanonicalText({
      name: "майка",
      attrs: {
        composition: "хлопок 100%",
        extra: { color: "белый", ageGroup: "взрослый" },
      },
    });
    expect(t).toContain("хлопок");
    expect(t).toContain("белый");
    expect(t).toContain("взрослый");
  });

  it("listSimilarPrecedents ranks CLIENT_HELPFUL higher at equal lexical score", async () => {
    const db = {
      verifiedDetermination: {
        findMany: async () => [
          {
            id: "broker-row",
            canonicalText: "майка хлопок трикотаж",
            hsCodeDigits: "6109100000",
            hsCodeFinal: "6109 10 000 0",
            quality: "BROKER",
            attrsSnapshot: null,
          },
          {
            id: "helpful-row",
            canonicalText: "майка хлопок трикотаж",
            hsCodeDigits: "6109900000",
            hsCodeFinal: "6109 90 000 0",
            quality: "CLIENT_HELPFUL",
            attrsSnapshot: null,
          },
        ],
      },
    };
    const out = await listSimilarPrecedents(db as never, { name: "майка хлопок" }, 3);
    expect(out[0]?.id).toBe("helpful-row");
    expect(out[0]?.quality).toBe("CLIENT_HELPFUL");
    expect(out[0]?.score).toBeGreaterThan(out[1]?.score ?? 0);
  });

  it("listSimilarPrecedents returns empty for short input", async () => {
    const db = {
      verifiedDetermination: {
        findMany: async () => {
          throw new Error("should not scan");
        },
      },
    };
    await expect(listSimilarPrecedents(db as never, { name: "аб" })).resolves.toEqual([]);
  });

  it("C35d: equivalent Latin/RU descriptions share fingerprint", () => {
    const a = buildFingerprint({
      name: "iPhone-15!",
      description: "Смартфон  Apple",
      attrs: { brand: "Apple", purpose: "телефон" },
    });
    const b = buildFingerprint({
      name: "iphone 15",
      description: "смартфон apple",
      attrs: { purpose: "телефон", brand: "Apple" },
    });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("C35d: CN-only name yields non-empty stable fingerprint", () => {
    const a = buildFingerprint({ name: "充电宝" });
    const b = buildFingerprint({ name: "充电宝" });
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(a).toContain("充电宝");
  });

  it("C35d: mixed CN+EN keeps both token families", () => {
    const fp = buildFingerprint({ name: "phone case 手机壳" });
    expect(fp).toContain("phone");
    expect(fp).toContain("case");
    expect(fp).toContain("手机壳");
  });
});
