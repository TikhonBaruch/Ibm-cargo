import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIRECTORY_HINTS_LIMIT,
  directoryHintHsHint,
  directoryHintsQuery,
  isSameDirectoryHint,
  preferExistingHsHint,
  shouldShowDirectoryHints,
} from "../new-calc-directory-hints";

describe("directoryHintsQuery", () => {
  it("rejects empty and 1-char input", () => {
    expect(directoryHintsQuery("")).toBeNull();
    expect(directoryHintsQuery("  ")).toBeNull();
    expect(directoryHintsQuery("н")).toBeNull();
  });

  it("uses the first line only", () => {
    expect(directoryHintsQuery("ноутбук")).toBe("ноутбук");
    expect(directoryHintsQuery("  ноутбук Lenovo  \nУточнения (ИИ): SSD")).toBe("ноутбук Lenovo");
  });
});

describe("shouldShowDirectoryHints", () => {
  it("is off in pack mode and without a query", () => {
    expect(shouldShowDirectoryHints({ enabled: false, query: "ноутбук" })).toBe(false);
    expect(shouldShowDirectoryHints({ enabled: true, query: "" })).toBe(false);
    expect(shouldShowDirectoryHints({ enabled: true, query: "ноутбук" })).toBe(true);
  });
});

describe("directoryHintHsHint", () => {
  it("stores spaced 10-digit form without putting it in the description", () => {
    expect(directoryHintHsHint("8471300000")).toBe("8471 30 000 0");
    expect(DIRECTORY_HINTS_LIMIT).toBe(5);
  });

  it("matches an already applied hint by digits", () => {
    expect(isSameDirectoryHint("8471 30 000 0", "8471300000")).toBe(true);
    expect(isSameDirectoryHint("8471410000", "8471300000")).toBe(false);
    expect(isSameDirectoryHint(undefined, "8471300000")).toBe(false);
  });
});

describe("preferExistingHsHint", () => {
  it("keeps a directory draft when clarify also returns a heading", () => {
    expect(preferExistingHsHint("8471 30 000 0", "8471")).toBe("8471 30 000 0");
    expect(preferExistingHsHint(undefined, "8471")).toBe("8471");
    expect(preferExistingHsHint("", "8471")).toBe("8471");
    expect(preferExistingHsHint("8471 30 000 0", undefined)).toBe("8471 30 000 0");
  });
});

describe("NewCalcDirectoryHints chrome", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/ved/client/NewCalcDirectoryHints.tsx"),
    "utf8",
  );

  it("reuses directory mask + tray, apply CTA is not a new заявка", () => {
    expect(src).toContain("ClientMaskedHsCode");
    expect(src).toContain("tnved-hits");
    expect(src).toContain("leafOnly=1");
    expect(src).toContain("Взять этот код в заявку");
    expect(src).toContain("Код взят в заявку");
    expect(src).not.toContain("Оформить заявку по этому коду");
    expect(src).not.toContain("HsCodeAutocomplete");
    expect(src).not.toContain("HsHintCandidates");
    expect(src).toContain("Уточнения слева не заменят этот черновик");
  });
});

describe("NewCalcPane keeps directory hsHint through create", () => {
  const pane = readFileSync(
    join(process.cwd(), "src/components/ved/client/NewCalcPane.tsx"),
    "utf8",
  );

  it("spreads item attrs into create and does not let clarify overwrite a taken hint", () => {
    expect(pane).toContain("preferExistingHsHint");
    expect(pane).toContain("...base.attrs");
    expect(pane).toContain("directoryHintHsHint");
  });
});
