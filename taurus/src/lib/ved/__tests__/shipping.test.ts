import { describe, expect, it } from "vitest";
import { isAllowedTrackingStatus, TRACKING_APPLY_STATUSES } from "../shipping";

describe("isAllowedTrackingStatus", () => {
  it("allows waybill tracking statuses", () => {
    for (const status of TRACKING_APPLY_STATUSES) {
      expect(isAllowedTrackingStatus(status)).toBe(true);
    }
  });

  it("rejects cancelled and unknown statuses", () => {
    expect(isAllowedTrackingStatus("CANCELLED")).toBe(false);
    expect(isAllowedTrackingStatus("LOST")).toBe(false);
    expect(isAllowedTrackingStatus("")).toBe(false);
  });
});
