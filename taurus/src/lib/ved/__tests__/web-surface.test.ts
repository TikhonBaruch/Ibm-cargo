import { describe, expect, it } from "vitest";
import { cabinetsOnWebMonolith, getWebSurface } from "../web-surface";

describe("web-surface (C5)", () => {
  it("defaults to full", () => {
    expect(getWebSurface({})).toBe("full");
    expect(cabinetsOnWebMonolith({})).toBe(true);
  });

  it("reads WEB_SURFACE=slim", () => {
    expect(getWebSurface({ WEB_SURFACE: "slim" })).toBe("slim");
    expect(cabinetsOnWebMonolith({ WEB_SURFACE: "slim" })).toBe(false);
  });

  it("reads APP_SURFACE alias", () => {
    expect(getWebSurface({ APP_SURFACE: "SLIM" })).toBe("slim");
  });
});
