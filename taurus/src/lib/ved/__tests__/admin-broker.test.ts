import { describe, expect, it } from "vitest";
import { adminBrokerPatchSchema } from "../admin-broker";

describe("adminBrokerPatchSchema", () => {
  it("allows moderate-only body", () => {
    expect(
      adminBrokerPatchSchema.parse({ brokerProfileId: "bp1", status: "APPROVED" })
    ).toMatchObject({ brokerProfileId: "bp1", status: "APPROVED" });
  });

  it("allows profile fields", () => {
    expect(
      adminBrokerPatchSchema.parse({
        brokerProfileId: "bp1",
        specialization: "ТН ВЭД электроника",
        about: "QC 5 лет",
      })
    ).toMatchObject({ specialization: "ТН ВЭД электроника" });
  });

  it("rejects empty update", () => {
    expect(() => adminBrokerPatchSchema.parse({ brokerProfileId: "bp1" })).toThrow();
  });
});
