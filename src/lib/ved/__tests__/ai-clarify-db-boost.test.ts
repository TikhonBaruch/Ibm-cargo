/**
 * Clar-DB: forklift ≠ AKB — packs, guards, attrs, fingerprint, demo-pack leaves.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { matchHintPack } from "../tnved-hint-trees";
import {
  isForkliftMachineQuery,
  isTractionBatteryQuery,
} from "../tnved-query-match";
import { heuristicAttrSuggest } from "../attr-suggest";
import {
  buildCanonicalText,
  buildFingerprint,
} from "../verified-determinations";
import { layerGToHint, matchLayerG } from "../tnved-layer-g";

describe("Clar-DB forklift / battery boost", () => {
  it("detects machine vs traction-battery queries", () => {
    expect(isForkliftMachineQuery("погрузчик")).toBe(true);
    expect(isForkliftMachineQuery("погрузчик с литий-ионным аккумулятором")).toBe(
      true,
    );
    expect(isForkliftMachineQuery("электропогрузчик")).toBe(true);
    expect(isForkliftMachineQuery("аккумулятор для погрузчика")).toBe(false);
    expect(isForkliftMachineQuery("тяговый аккумулятор")).toBe(false);

    expect(isTractionBatteryQuery("аккумулятор для погрузчика")).toBe(true);
    expect(isTractionBatteryQuery("тяговый аккумулятор")).toBe(true);
    expect(isTractionBatteryQuery("погрузчик электрический")).toBe(false);
  });

  it("pack: machine → forklift-trucks; AKB → batteries; no batteries steal", () => {
    expect(matchHintPack("погрузчик")?.id).toBe("forklift-trucks");
    expect(matchHintPack("вилочный погрузчик")?.id).toBe("forklift-trucks");
    expect(matchHintPack("погрузчик с литий-ионным аккумулятором")?.id).toBe(
      "forklift-trucks",
    );
    expect(matchHintPack("штабелер")?.id).toBe("forklift-trucks");
    expect(matchHintPack("аккумулятор для погрузчика")?.id).toBe("batteries");
    expect(matchHintPack("тяговый аккумулятор")?.id).toBe("batteries");
    expect(matchHintPack("аккумулятор литий-ионный")?.id).toBe("batteries");
  });

  it("attr RULES: forklift hsHint 8427; traction AKB 8507", () => {
    const truck = heuristicAttrSuggest({ name: "погрузчик электрический" });
    expect(truck.attrs.hsHint).toMatch(/^8427/);
    expect(truck.attrs.extra?.vehicleKind).toBe("forklift");
    expect(truck.attrs.extra?.powerSource).toBeTruthy();

    const mixed = heuristicAttrSuggest({
      name: "погрузчик с литий-ионным аккумулятором",
    });
    expect(mixed.attrs.hsHint).toMatch(/^8427/);
    expect(mixed.attrs.extra?.vehicleKind).toBe("forklift");

    const akb = heuristicAttrSuggest({
      name: "тяговый литий-ионный аккумулятор для погрузчика",
    });
    expect(akb.attrs.hsHint).toMatch(/^8507/);
    expect(akb.attrs.extra?.vehicleKind).toBe("battery-only");
    expect(akb.attrs.extra?.powerSource).toBe("battery-pack");

    const traction = heuristicAttrSuggest({ name: "тяговый аккумулятор" });
    expect(traction.attrs.hsHint).toMatch(/^8507/);
    expect(traction.attrs.extra?.powerSource).toBe("battery-pack");
  });

  it("fingerprint includes powerSource / vehicleKind", () => {
    const a = buildCanonicalText({
      name: "погрузчик",
      attrs: { extra: { powerSource: "electric", vehicleKind: "forklift" } },
    });
    expect(a).toContain("electric");
    expect(a).toContain("forklift");

    const fpTruck = buildFingerprint({
      name: "вилочный электропогрузчик",
      attrs: {
        composition: "сталь; Li-ion",
        purpose: "складской погрузчик",
        extra: { powerSource: "electric", vehicleKind: "forklift" },
      },
    });
    const fpAkb = buildFingerprint({
      name: "тяговый литий-ионный аккумулятор для погрузчика",
      attrs: {
        composition: "литий-ион",
        purpose: "тяговый аккумулятор",
        extra: { powerSource: "battery-pack", vehicleKind: "battery-only" },
      },
    });
    expect(fpTruck).not.toBe(fpAkb);
  });

  it("Layer G: 8427 util; 8507 eco not util", () => {
    const truck = layerGToHint(matchLayerG("8427101000"));
    expect(truck.utilSborPossible).toBe(true);
    expect(truck.ecoFeePossible).toBe(false);

    const akb = layerGToHint(matchLayerG("8507600000"));
    expect(akb.utilSborPossible).toBe(false);
    expect(akb.ecoFeePossible).toBe(true);
  });

  it("demo-pack includes 8427 leaves and enriched 8507 notes", () => {
    const packPath = path.join(
      process.cwd(),
      "scripts/fixtures/tnved/demo-pack.json",
    );
    const pack = JSON.parse(fs.readFileSync(packPath, "utf8")) as {
      leafCount: number;
      items: Array<{ code: string; notes?: string | null; isLeaf?: boolean }>;
    };
    const byCode = Object.fromEntries(pack.items.map((i) => [i.code, i]));
    expect(byCode["8427101000"]?.isLeaf).toBe(true);
    expect(byCode["8427201900"]?.isLeaf).toBe(true);
    expect(String(byCode["8427101000"]?.notes)).toMatch(/погрузчик/i);
    expect(String(byCode["8507600000"]?.notes)).toMatch(/тяговый|8507/i);
    expect(String(byCode["8507600000"]?.notes)).toMatch(/не.*8427|не код машины/i);
    expect(pack.leafCount).toBeGreaterThanOrEqual(61);
  });
});
