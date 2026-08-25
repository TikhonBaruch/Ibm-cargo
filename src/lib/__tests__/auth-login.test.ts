import { describe, expect, it } from "vitest";
import { messageForAuthError, normalizeLoginEmail } from "../auth-login";

describe("normalizeLoginEmail", () => {
  it("expands client@ shorthand", () => {
    expect(normalizeLoginEmail("client@")).toBe("client@example.com");
    expect(normalizeLoginEmail("BROKER@")).toBe("broker@example.com");
    expect(normalizeLoginEmail("manufacturer@")).toBe("manufacturer@example.com");
    expect(normalizeLoginEmail("operator@")).toBe("operator@example.com");
    expect(normalizeLoginEmail("admin@")).toBe("admin@example.com");
  });

  it("expands local-part-only client", () => {
    expect(normalizeLoginEmail(" Broker ")).toBe("broker@example.com");
  });

  it("trims and lowercases a full email", () => {
    expect(normalizeLoginEmail("  Client@Example.com  ")).toBe("client@example.com");
  });

  it("does not rewrite a non-demo domain", () => {
    expect(normalizeLoginEmail("client@other.com")).toBe("client@other.com");
  });
});

describe("messageForAuthError", () => {
  it("keeps Configuration and Callback copy", () => {
    expect(messageForAuthError("Configuration")).toMatch(/NEXTAUTH_SECRET/);
    expect(messageForAuthError("Callback")).toMatch(/DATABASE_URL/);
    expect(messageForAuthError("Callback")).toMatch(/без #/);
  });

  it("keeps generic CredentialsSignin with operator hint", () => {
    const msg = messageForAuthError("CredentialsSignin");
    expect(msg).toMatch(/^Неверный email или пароль/);
    expect(msg).toMatch(/client@example.com/);
    expect(msg).toMatch(/newlsu_lbm/);
    expect(msg).toMatch(/register/);
  });
});
