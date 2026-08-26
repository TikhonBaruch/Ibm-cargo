import { describe, expect, it } from "vitest";
import { buildInfraSections, parsePostgresUrl } from "../infra-access";
import { asEnv } from "../../test-env";

describe("parsePostgresUrl", () => {
  it("parses host user password database", () => {
    const p = parsePostgresUrl(
      "postgresql://appuser:p%23ass@db.example.com:5433/appdb?sslmode=require"
    );
    expect(p.present).toBe(true);
    expect(p.host).toBe("db.example.com");
    expect(p.port).toBe("5433");
    expect(p.user).toBe("appuser");
    expect(p.password).toBe("p#ass");
    expect(p.database).toBe("appdb");
    expect(p.sslmode).toBe("require");
  });

  it("handles missing url", () => {
    expect(parsePostgresUrl(undefined).present).toBe(false);
  });

  it("parses as-is sweb LBM shape (password is a placeholder)", () => {
    const p = parsePostgresUrl(
      "postgresql://newlsu_lbm:secret@pg4.sweb.ru:5433/newlsu_lbm?schema=public&connect_timeout=15&sslmode=require"
    );
    expect(p.present).toBe(true);
    expect(p.host).toBe("pg4.sweb.ru");
    expect(p.port).toBe("5433");
    expect(p.user).toBe("newlsu_lbm");
    expect(p.database).toBe("newlsu_lbm");
    expect(p.sslmode).toBe("require");
  });

  it("treats '#' in a pasted password as an unusable URL (fragment, not the sweb password)", () => {
    const p = parsePostgresUrl(
      "postgresql://u:xxxx#rest@pg4.sweb.ru:5433:/db"
    );
    expect(p.present).toBe(true);
    expect(p.host).toBeUndefined();
    expect(p.database).toBeUndefined();
  });

  it("treats extra colon after port as an unusable URL", () => {
    const p = parsePostgresUrl(
      "postgresql://u:secret@pg4.sweb.ru:5433:/newlsu_lbm?sslmode=require"
    );
    expect(p.present).toBe(true);
    expect(p.host).toBeUndefined();
    expect(p.port).toBeUndefined();
    expect(p.database).toBeUndefined();
  });
});

describe("buildInfraSections", () => {
  it("includes database section from env", () => {
    const sections = buildInfraSections(asEnv({
      DATABASE_URL: "postgresql://u:secret@db.example:5432/app",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
      S3_BUCKET: "b",
      S3_ENDPOINT: "https://storage.example",
      S3_ACCESS_KEY: "ak",
      S3_SECRET_KEY: "sk",
      OPS_HOST: "https://panel.example",
      OPS_USER: "ops",
      OPS_PASSWORD: "opspass",
    }));
    const db = sections.find((s) => s.id === "database");
    expect(db?.credentials[0]?.login).toBe("u");
    expect(db?.credentials[0]?.password).toBe("secret");
    const host = sections.find((s) => s.id === "hosting");
    expect(host?.credentials[0]?.password).toBe("opspass");
    expect(sections.some((s) => s.id === "structure")).toBe(true);
    expect(sections.some((s) => s.id === "database")).toBe(true);
    const dumped = JSON.stringify(sections);
    expect(dumped).not.toContain("2178737@gmail.com");
    expect(dumped).not.toContain("SUPER_ADMIN");
    expect(dumped).not.toMatch(/demo1234/);
    const vedAdmin = sections
      .find((s) => s.id === "structure")
      ?.credentials.find((c) => c.label === "VED-админ");
    expect(vedAdmin?.password).toBeUndefined();
    expect(vedAdmin?.login).toBeUndefined();
  });
});
