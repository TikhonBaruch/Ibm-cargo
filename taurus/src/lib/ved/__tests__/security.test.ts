import { describe, it, expect } from "vitest";
import { buildPdfHtml, canTransition, computePayments, needsBroker } from "../domain";
import { matchesProtectedMutation, resolvePathAccess } from "../access";

/**
 * Security-focused checks for VED domain (OWASP-inspired unit probes):
 * - authorization boundaries
 * - status-machine abuse
 * - output encoding / injection in PDF HTML
 * - financial non-negativity invariants
 */
describe("Security — authorization boundaries", () => {
  it("USER cannot access client cabinet", () => {
    const d = resolvePathAccess("USER", "/cabinet");
    expect(d.type).not.toBe("allow");
  });

  it("SPECIALIST cannot access broker cabinet", () => {
    const d = resolvePathAccess("SPECIALIST", "/broker/queue");
    expect(d.type).not.toBe("allow");
  });

  it("IDOR-shaped pay path is always a protected mutation", () => {
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/../admin/pay")).toBe(false);
    expect(matchesProtectedMutation("POST", "/api/v1/calculations/cuid123/pay")).toBe(true);
  });
});

describe("Security — status machine abuse", () => {
  const attacks: Array<[Parameters<typeof canTransition>[0], Parameters<typeof canTransition>[1]]> = [
    ["DRAFT", "DONE"],
    ["DRAFT", "QUEUED"],
    ["AI_READY", "IN_REVIEW"],
    ["QUEUED", "DONE"],
    ["DONE", "AI_READY"],
    ["CANCELLED", "QUEUED"],
  ];

  it.each(attacks)("rejects illegal transition %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("Security — PDF HTML injection surface", () => {
  it("keeps a single HTML document shell", () => {
    const payload = `<img src=x onerror=alert(1)>`;
    const html = buildPdfHtml({
      number: "#1",
      title: payload,
      hsCodeFinal: payload,
      brokerComment: payload,
      disclaimer: payload,
    });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html.split("<!DOCTYPE html>").length).toBe(2);
  });

  it("escapes script payloads in title / HS / comments", () => {
    const html = buildPdfHtml({
      number: "#2",
      title: "<script>alert(1)</script>",
      hsCodeFinal: "<script>",
      brokerComment: '"><img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });
});

describe("Security — financial / tariff invariants", () => {
  it("Express high confidence must not force broker queue", () => {
    expect(needsBroker("EXPRESS", 0.99, 0.75)).toBe(false);
  });

  it("paid broker tariffs cannot bypass broker via high confidence", () => {
    expect(needsBroker("STANDARD", 1, 0.99)).toBe(true);
    expect(needsBroker("PRO", 1, 0.99)).toBe(true);
  });

  it("computePayments stays finite for extreme but valid rates", () => {
    const p = computePayments({
      shipmentValueUsd: 1e6,
      dutyPercent: 100,
      vatPercent: 100,
      feeRub: 1,
      usdRate: 200,
    });
    expect(Number.isFinite(p.totalPaymentsRub)).toBe(true);
    expect(p.totalPaymentsRub).toBeGreaterThan(0);
  });
});
