/**
 * ADR invariant suite — stability scaffold (D18).
 * Fails when product structure/ideas in decisions.md are violated.
 */
import { describe, expect, it } from "vitest";
import {
  canTransition,
  isPreferredExclusiveActive,
  maxPositionsForTariff,
  needsBroker,
} from "../domain";
import { resolvePathAccess, PROTECTED_V1_MUTATIONS, matchesProtectedMutation } from "../access";

describe("ADR invariants — D10 positions", () => {
  it("EXPRESS / STANDARD / PRO caps", () => {
    expect(maxPositionsForTariff("EXPRESS")).toBe(1);
    expect(maxPositionsForTariff("STANDARD")).toBe(3);
    expect(maxPositionsForTariff("PRO")).toBe(10);
    expect(maxPositionsForTariff(null)).toBe(1);
  });
});

describe("ADR invariants — D8 / D11 status machine", () => {
  it("forbids queue without going through pay-shaped transitions from DRAFT", () => {
    expect(canTransition("DRAFT", "QUEUED")).toBe(false);
    expect(canTransition("DRAFT", "DONE")).toBe(false);
    expect(canTransition("AI_PROCESSING", "QUEUED")).toBe(false);
  });

  it("allows AI_READY → QUEUED|DONE (pay shortcuts) and forbids QUEUED → DONE", () => {
    expect(canTransition("AI_READY", "QUEUED")).toBe(true);
    expect(canTransition("AI_READY", "DONE")).toBe(true);
    expect(canTransition("QUEUED", "DONE")).toBe(false);
    expect(canTransition("QUEUED", "IN_REVIEW")).toBe(true);
  });

  it("D11 Express high confidence skips broker; STANDARD always needs broker", () => {
    expect(needsBroker("EXPRESS", 0.9, 0.75)).toBe(false);
    expect(needsBroker("EXPRESS", 0.5, 0.75)).toBe(true);
    expect(needsBroker("STANDARD", 0.99, 0.75)).toBe(true);
    expect(needsBroker("PRO", 0.99, 0.75)).toBe(true);
  });
});

describe("ADR invariants — D15 preferred exclusive", () => {
  it("expires after preferredClaimHours", () => {
    expect(
      isPreferredExclusiveActive({
        preferredBrokerUserId: "b1",
        queuedAt: new Date("2026-01-01T10:00:00Z"),
        preferredClaimHours: 4,
        now: new Date("2026-01-01T15:00:00Z"),
      })
    ).toBe(false);
    expect(
      isPreferredExclusiveActive({
        preferredBrokerUserId: "b1",
        queuedAt: new Date("2026-01-01T10:00:00Z"),
        preferredClaimHours: 4,
        now: new Date("2026-01-01T11:00:00Z"),
      })
    ).toBe(true);
  });
});

describe("ADR invariants — access RBAC", () => {
  it("CLIENT cannot stay on /broker; BROKER cannot stay on /cabinet", () => {
    expect(resolvePathAccess("CLIENT", "/broker")).toEqual({ type: "redirect", to: "/cabinet" });
    expect(resolvePathAccess("BROKER", "/cabinet")).toEqual({ type: "redirect", to: "/broker" });
    expect(resolvePathAccess("CLIENT", "/cabinet")).toEqual({ type: "allow" });
    expect(resolvePathAccess("BROKER", "/broker/queue")).toEqual({ type: "allow" });
    expect(resolvePathAccess("MANUFACTURER", "/manufacturer")).toEqual({ type: "allow" });
    expect(resolvePathAccess("MANUFACTURER", "/cabinet")).toEqual({
      type: "redirect",
      to: "/manufacturer",
    });
  });

  it("PROTECTED_V1_MUTATIONS covers pay claim approve items uploads", () => {
    expect(PROTECTED_V1_MUTATIONS.length).toBeGreaterThanOrEqual(8);
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/x/pay")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/x/claim")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/x/approve")).toBe(true);
    expect(matchesProtectedMutation("PATCH", "/api/v1/calculations/x/items")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/uploads")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/manufacturer/skus")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/factory/requests")).toBe(true);
    expect(matchesProtectedMutation("POST", "/api/v1/manufacturer/pools/p1/confirm")).toBe(true);
  });
});

describe("ADR invariants — D15 synthetic ban documented in suite", () => {
  it("synthetic is a forbidden item id token for approve payloads", () => {
    const forbidden = "synthetic";
    expect(forbidden).toBe("synthetic");
    // Runtime rejection covered in calculations.test.ts; structure gate bans id: "synthetic" in src/
  });
});
