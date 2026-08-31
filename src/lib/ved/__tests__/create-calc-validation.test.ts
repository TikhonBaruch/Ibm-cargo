import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  hasRequiredCreateAttrs,
  missingRequiredCreateAttrs,
  requiredCreateAttrsError,
  productAttrsSchema,
} from "../product-description";

/** Mirror of create refine in app/api/v1/calculations/route.ts (keep in sync). */
const itemSchema = z.object({
  name: z.string().max(200).optional().default(""),
  attrs: productAttrsSchema.optional(),
  manufacturerSkuId: z.string().min(1).max(40).optional(),
});

const createSchema = z
  .object({
    title: z.string().min(2).max(200),
    description: z.string().min(5).max(5000),
    items: z.array(itemSchema).min(1).max(10).optional(),
  })
  .superRefine((body, ctx) => {
    const items = body.items?.length
      ? body.items
      : [{ name: body.title, attrs: undefined, manufacturerSkuId: undefined }];
    items.forEach((it, i) => {
      if (!String(it.name || "").trim() && !it.manufacturerSkuId) return;
      if (it.manufacturerSkuId) return;
      if (hasRequiredCreateAttrs(it.attrs)) return;
      const miss = missingRequiredCreateAttrs(it.attrs);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: body.items?.length ? ["items", i, "attrs"] : ["items"],
        message: requiredCreateAttrsError(miss),
      });
    });
  });

/** Same status mapping as POST /api/v1/calculations catch. */
function statusForCreateError(e: unknown): { status: number; error: string } {
  if (e instanceof z.ZodError) {
    return { status: 400, error: e.issues[0]?.message || "Некорректные данные заявки" };
  }
  const message = e instanceof Error ? e.message : "Failed to create calculation";
  const status =
    /required|Too many|Обязательн|At least one|Company required/i.test(message) ? 400 : 500;
  return { status, error: message };
}

describe("create calculation validation → HTTP mapping", () => {
  it("maps missing required attrs ZodError to 400 with readable message", () => {
    const parsed = createSchema.safeParse({
      title: "Ноутбук",
      description: "ThinkPad без attrs",
      items: [{ name: "ThinkPad X1" }],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const out = statusForCreateError(parsed.error);
    expect(out.status).toBe(400);
    expect(out.error).toMatch(/originCountry|состав/i);
    expect(out.error).not.toMatch(/производитель/i);
    expect(out.error.startsWith("[")).toBe(false);
  });

  it("accepts origin + composition without manufacturerName", () => {
    const parsed = createSchema.safeParse({
      title: "Ноутбук",
      description: "ThinkPad без производителя",
      items: [
        {
          name: "ThinkPad X1",
          attrs: {
            originCountry: "CN",
            composition: "aluminium, plastics",
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts complete required attrs", () => {
    const parsed = createSchema.safeParse({
      title: "Ноутбук",
      description: "ThinkPad с attrs",
      items: [
        {
          name: "ThinkPad X1",
          attrs: {
            originCountry: "CN",
            manufacturerName: "Lenovo",
            composition: "aluminium, plastics",
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("maps domain Обязательн… throw to 400", () => {
    const out = statusForCreateError(
      new Error(
        requiredCreateAttrsError(["composition"])
      )
    );
    expect(out.status).toBe(400);
  });
});
