import { afterEach, describe, expect, it, vi } from "vitest";
import { asEnv } from "../../test-env";
import {
  extractTableFromVisionImage,
  isImageFilename,
  sheetTableFromVisionItems,
  visionImportConfigured,
} from "../import-vision";

describe("import-vision", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("detects image filenames", () => {
    expect(isImageFilename("a.jpg")).toBe(true);
    expect(isImageFilename("a.WEBP")).toBe(true);
    expect(isImageFilename("a.csv")).toBe(false);
    expect(isImageFilename("x.bin", "image/png")).toBe(true);
  });

  it("maps vision items to a sheet table", () => {
    const table = sheetTableFromVisionItems([
      { name: "Носки", description: "хлопок", qty: 10, unitPrice: 1.5 },
    ]);
    expect(table.headers[0]).toBe("name");
    expect(table.rows[0]?.[0]).toBe("Носки");
    expect(table.rows[0]?.[2]).toBe("10");
  });

  it("skips vision without keys", async () => {
    expect(visionImportConfigured(asEnv({}))).toBe(false);
    await expect(
      extractTableFromVisionImage({ imageBase64: "aaaa" }, asEnv({}))
    ).resolves.toBeNull();
  });

  it("parses table JSON from DeepSeek vision", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  kind: "table",
                  items: [
                    { name: "Кабель USB", qty: 2, unitPrice: 3 },
                    { name: "Зарядка", qty: 1 },
                  ],
                  description: "",
                }),
              },
            },
          ],
        }),
      }))
    );
    const env = asEnv({
      DEEPSEEK_API_KEY: "sk-test",
      AI_CHAIN_ID: "3",
    });
    const out = await extractTableFromVisionImage(
      { imageBase64: "ZmFrZQ==", mimeType: "image/jpeg" },
      env
    );
    expect(out?.kind).toBe("table");
    expect(out?.items).toHaveLength(2);
    expect(out?.items[0]?.name).toBe("Кабель USB");
    expect(out?.engine).toBe("deepseek-vision-v1");
  });
});
