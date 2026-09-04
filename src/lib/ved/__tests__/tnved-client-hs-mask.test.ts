/**
 * Client HS mask: 10-digit → first 3 clear, rest •.
 * Canon: docs/knowledge/plan-tnved-client-hs-blur.md
 */
import { describe, expect, it } from "vitest";
import { formatHsCodeMaskedForClient, maskHsCodeForClient } from "../tnved-client-hs-mask";

describe("maskHsCodeForClient", () => {
  it("masks after 3 digits for 10-digit codes", () => {
    const p = maskHsCodeForClient("8471300000");
    expect(p?.head).toBe("847");
    expect(p?.tail).toBe("• •• ••• •");
    expect(p?.digits).toBe("8471300000");
    expect(formatHsCodeMaskedForClient("8471 30 000 0")).toBe("847• •• ••• •");
  });

  it("does not mask shorter codes", () => {
    expect(maskHsCodeForClient("8471")).toBeNull();
    expect(maskHsCodeForClient("847130")).toBeNull();
    expect(formatHsCodeMaskedForClient("8471")).toBe("84 71");
  });
});
