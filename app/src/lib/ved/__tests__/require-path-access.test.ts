import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveUiPathGate } from "../require-path-access";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock("@/lib/require-role", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/require-role";
import { requirePathAccess } from "../require-path-access";

const mockedSession = getSession as unknown as ReturnType<typeof vi.fn>;

describe("resolveUiPathGate", () => {
  it("allows public login without role", () => {
    expect(resolveUiPathGate(undefined, "/login")).toEqual({ type: "allow" });
    expect(resolveUiPathGate(undefined, "/admin/login")).toEqual({ type: "allow" });
    expect(resolveUiPathGate(undefined, "/2178737/login")).toEqual({ type: "allow" });
  });

  it("sends anonymous cabinet traffic to /login", () => {
    expect(resolveUiPathGate(undefined, "/cabinet")).toEqual({
      type: "redirect",
      to: "/login",
    });
    expect(resolveUiPathGate(undefined, "/broker")).toEqual({
      type: "redirect",
      to: "/login",
    });
    expect(resolveUiPathGate(undefined, "/manufacturer")).toEqual({
      type: "redirect",
      to: "/login",
    });
    expect(resolveUiPathGate(undefined, "/admin")).toEqual({
      type: "redirect",
      to: "/login",
    });
  });

  it("sends anonymous SUPER surface to obscure login", () => {
    expect(resolveUiPathGate(undefined, "/2178737/posts")).toEqual({
      type: "redirect",
      to: "/2178737/login",
    });
  });

  it("redirects CLIENT away from /broker", () => {
    expect(resolveUiPathGate("CLIENT", "/broker")).toEqual({
      type: "redirect",
      to: "/client",
    });
  });

  it("allows CLIENT on /cabinet", () => {
    expect(resolveUiPathGate("CLIENT", "/cabinet/orders")).toEqual({ type: "allow" });
  });

  it("redirects ADMIN away from SUPER CMS", () => {
    expect(resolveUiPathGate("ADMIN", "/2178737")).toEqual({
      type: "redirect",
      to: "/admin",
    });
  });
});

describe("requirePathAccess", () => {
  beforeEach(() => {
    mockedSession.mockReset();
  });

  it("redirects when session missing", async () => {
    mockedSession.mockResolvedValue(null);
    await expect(requirePathAccess("/cabinet")).rejects.toThrow("REDIRECT:/login");
  });

  it("allows when role matches", async () => {
    mockedSession.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(requirePathAccess("/cabinet")).resolves.toBeUndefined();
  });

  it("redirects wrong role", async () => {
    mockedSession.mockResolvedValue({ user: { role: "CLIENT" } });
    await expect(requirePathAccess("/broker")).rejects.toThrow("REDIRECT:/client");
  });
});
