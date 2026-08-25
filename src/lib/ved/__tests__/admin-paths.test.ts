import { describe, expect, it } from "vitest";
import { ADMIN_CABINET_PATHS } from "../admin-paths";

describe("ADMIN_CABINET_PATHS (VED chrome)", () => {
  it("includes support orch users integrations audit", () => {
    expect(ADMIN_CABINET_PATHS.has("/admin/support")).toBe(true);
    expect(ADMIN_CABINET_PATHS.has("/admin/orch")).toBe(true);
    expect(ADMIN_CABINET_PATHS.has("/admin/bookings")).toBe(true);
    expect(ADMIN_CABINET_PATHS.has("/admin/settings")).toBe(true);
    expect(ADMIN_CABINET_PATHS.has("/admin/integrations")).toBe(true);
    expect(ADMIN_CABINET_PATHS.has("/admin/users")).toBe(true);
    expect(ADMIN_CABINET_PATHS.has("/admin/audit")).toBe(true);
    expect(ADMIN_CABINET_PATHS.has("/admin/tnved")).toBe(true);
  });

  it("does not treat Legacy CMS routes as VED cabinet paths", () => {
    expect(ADMIN_CABINET_PATHS.has("/admin/posts")).toBe(false);
    expect(ADMIN_CABINET_PATHS.has("/admin/chat")).toBe(false);
    expect(ADMIN_CABINET_PATHS.has("/admin/gallery")).toBe(false);
  });
});
