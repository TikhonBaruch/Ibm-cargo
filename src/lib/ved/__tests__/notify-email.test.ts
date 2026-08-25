import { describe, expect, it, vi } from "vitest";
import { canSendInlineEmail, sendInlineEmail } from "@/lib/ved/notify-email";

describe("notify-email", () => {
  it("skips when no RESEND_API_KEY", async () => {
    const prev = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    expect(canSendInlineEmail()).toBe(false);
    const r = await sendInlineEmail({
      to: "a@b.co",
      template: "calc.approved",
      payload: { number: "#1" },
    });
    expect(r.skipped).toBe(true);
    if (prev != null) process.env.RESEND_API_KEY = prev;
  });

  it("skips non-email recipients", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const r = await sendInlineEmail({ to: "user_id_only", template: "generic" });
    expect(r.skipped).toBe(true);
    delete process.env.RESEND_API_KEY;
  });
});
