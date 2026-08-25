import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("../auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";
import {
  requireRole,
  ADMIN_ROLES,
  CLIENT_ROLES,
  BROKER_ROLES,
  DOMAIN_ROLES,
} from "../require-role";

const mockedSession = getServerSession as unknown as ReturnType<typeof vi.fn>;

describe("requireRole", () => {
  beforeEach(() => {
    mockedSession.mockReset();
  });

  it("returns 401 when no session", async () => {
    mockedSession.mockResolvedValue(null);
    const { session, error } = await requireRole(ADMIN_ROLES);
    expect(session).toBeNull();
    expect(error?.status).toBe(401);
  });

  it("returns 403 when role not allowed", async () => {
    mockedSession.mockResolvedValue({ user: { role: "CLIENT" } });
    const { session, error } = await requireRole(ADMIN_ROLES);
    expect(session).toBeNull();
    expect(error?.status).toBe(403);
  });

  it("allows CLIENT for CLIENT_ROLES", async () => {
    mockedSession.mockResolvedValue({ user: { role: "CLIENT", email: "c@x" } });
    const { session, error } = await requireRole(CLIENT_ROLES);
    expect(error).toBeNull();
    expect(session?.user).toBeTruthy();
  });

  it("allows BROKER for BROKER_ROLES", async () => {
    mockedSession.mockResolvedValue({ user: { role: "BROKER" } });
    const { error } = await requireRole(BROKER_ROLES);
    expect(error).toBeNull();
  });

  it("ADMIN is in DOMAIN_ROLES", async () => {
    mockedSession.mockResolvedValue({ user: { role: "ADMIN" } });
    const { error } = await requireRole(DOMAIN_ROLES);
    expect(error).toBeNull();
  });

  it("USER is rejected from DOMAIN_ROLES", async () => {
    mockedSession.mockResolvedValue({ user: { role: "USER" } });
    const { error } = await requireRole(DOMAIN_ROLES);
    expect(error?.status).toBe(403);
  });
});

describe("role constant hygiene", () => {
  it("CLIENT_ROLES includes staff for support impersonation paths", () => {
    expect(CLIENT_ROLES).toContain("CLIENT");
    expect(CLIENT_ROLES).toContain("ADMIN");
  });

  it("BROKER_ROLES does not include CLIENT", () => {
    expect(BROKER_ROLES).not.toContain("CLIENT");
  });

  it("DOMAIN_ROLES includes MANUFACTURER and not USER", async () => {
    expect(DOMAIN_ROLES).toContain("MANUFACTURER");
    expect(DOMAIN_ROLES).not.toContain("USER");
    mockedSession.mockResolvedValue({ user: { role: "MANUFACTURER" } });
    const { error } = await requireRole(DOMAIN_ROLES);
    expect(error).toBeNull();
  });

  it("ADMIN_ROLES does not include EDITOR", () => {
    expect(ADMIN_ROLES).not.toContain("EDITOR");
  });
});
