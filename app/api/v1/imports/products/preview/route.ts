/**
 * POST /api/v1/imports/products/preview — CSV/XLSX/PDF/image parse + per-row classify.
 * Accepts JSON `{ csv }` / `{ xlsxBase64 }` / `{ pdfBase64 }` / `{ imageBase64 }` or multipart `file`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/ved/settings";
import {
  parseProductCsv,
  parseProductXlsx,
  parseProductPdf,
  mapCsvToRows,
  classifyImportRows,
  enrichImportCreateAttrs,
  isXlsxFilename,
  isPdfFilename,
  isImageFilename,
  type SheetTable,
} from "@/lib/ved/product-import";
import {
  extractInvoiceTableForChain,
  importPreviewAllowsEmptyRows,
  type InvoiceVisionExtract,
} from "@/lib/ved/invoice-vision-table";
import { optionalAllowedMediaUrlSchema } from "@/lib/ved/media-url";
import { findBestPrecedent } from "@/lib/ved/verified-determinations";
import { buildCascadeDraft } from "@/lib/ved/tnved-classify";
import { maxPositionsForTariff } from "@/lib/ved/domain";
import { resolveOriginCountryCode } from "@/lib/ved/field-suggest";
import type { TariffCode } from "@prisma/client";

/** Vision + PDF parse can exceed the default Hobby kill; crash page shows Request ID. */
export const maxDuration = 120;

const jsonSchema = z.object({
  csv: z.string().min(1).max(500_000).optional(),
  xlsxBase64: z.string().min(1).max(2_000_000).optional(),
  pdfBase64: z.string().min(1).max(4_000_000).optional(),
  imageBase64: z.string().min(1).max(4_000_000).optional(),
  mimeType: z.string().max(80).optional(),
  mediaUrl: optionalAllowedMediaUrlSchema,
  filename: z.string().max(200).optional(),
  tariffCode: z.enum(["EXPRESS", "STANDARD", "PRO"]).optional(),
  country: z.string().optional(),
  shipmentValue: z.string().optional(),
});

type PreviewKind = "sheet" | "image";

type TableFromRequest = {
  table: SheetTable;
  kind: PreviewKind;
  vision?: { attempted: boolean; engine?: string; error?: string };
  tariffCode?: string;
  country?: string;
  shipmentValue?: string;
};

function visionMeta(extracted: InvoiceVisionExtract | null): TableFromRequest["vision"] {
  if (!extracted) return { attempted: false };
  return {
    attempted: true,
    engine: extracted.engine,
    error: extracted.error,
  };
}

async function tableFromImage(opts: {
  imageBase64?: string;
  mimeType?: string;
  mediaUrl?: string;
  filename?: string;
}): Promise<{ table: SheetTable; vision: TableFromRequest["vision"] }> {
  const extracted = await extractInvoiceTableForChain(opts);
  return {
    table: extracted?.table || { headers: ["name", "description", "qty", "цена"], rows: [] },
    vision: visionMeta(extracted),
  };
}

async function tableFromOcrService(
  pdfBase64: string,
  filename?: string
): Promise<SheetTable | null> {
  const ocrUrl = (process.env.OCR_SERVICE_URL || "").replace(/\/$/, "");
  if (!ocrUrl) return null;
  try {
    const res = await fetch(`${ocrUrl}/v1/extract-table`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfBase64,
        filename,
        mimeType: "application/pdf",
      }),
      signal: AbortSignal.timeout(Number(process.env.OCR_TIMEOUT_MS || 20000)),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      headers?: string[];
      rows?: string[][];
      items?: Array<{ name: string; description?: string; qty?: number; unitPrice?: number }>;
    };
    if (data.headers?.length && data.rows?.length) {
      return { headers: data.headers, rows: data.rows };
    }
    if (data.items?.length) {
      return {
        headers: ["name", "description", "qty", "цена"],
        rows: data.items.map((it) => [
          it.name,
          it.description || "",
          it.qty != null ? String(it.qty) : "",
          it.unitPrice != null ? String(it.unitPrice) : "",
        ]),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function tableFromPdf(
  buf: Buffer,
  filename?: string
): Promise<SheetTable> {
  let table = await parseProductPdf(buf);
  if (mapCsvToRows(table.headers, table.rows).length) return table;
  const fromOcr = await tableFromOcrService(buf.toString("base64"), filename);
  if (fromOcr) return fromOcr;
  return table;
}

async function tableFromRequest(req: NextRequest): Promise<TableFromRequest> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("file required");
    const buf = Buffer.from(await file.arrayBuffer());
    const fields = {
      tariffCode: String(form.get("tariffCode") || "") || undefined,
      country: String(form.get("country") || "") || undefined,
      shipmentValue: String(form.get("shipmentValue") || "") || undefined,
    };
    if (isImageFilename(file.name) || String(file.type || "").startsWith("image/")) {
      const fromImage = await tableFromImage({
        imageBase64: buf.toString("base64"),
        mimeType: file.type,
        filename: file.name,
      });
      return { ...fromImage, kind: "image", ...fields };
    }
    let table: SheetTable;
    if (isPdfFilename(file.name)) {
      table = await tableFromPdf(buf, file.name);
    } else if (isXlsxFilename(file.name)) {
      table = parseProductXlsx(buf);
    } else {
      table = parseProductCsv(buf.toString("utf8"));
    }
    return { table, kind: "sheet", ...fields };
  }

  const body = jsonSchema.parse(await req.json());
  const fields = {
    tariffCode: body.tariffCode,
    country: body.country,
    shipmentValue: body.shipmentValue,
  };
  if (body.imageBase64 || body.mediaUrl) {
    const fromImage = await tableFromImage({
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      mediaUrl: body.mediaUrl,
      filename: body.filename,
    });
    return { ...fromImage, kind: "image", ...fields };
  }
  if (body.pdfBase64) {
    const buf = Buffer.from(body.pdfBase64, "base64");
    return {
      table: await tableFromPdf(buf, body.filename),
      kind: "sheet",
      ...fields,
    };
  }
  if (body.xlsxBase64) {
    const buf = Buffer.from(body.xlsxBase64, "base64");
    return {
      table: parseProductXlsx(buf),
      kind: "sheet",
      ...fields,
    };
  }
  if (body.csv) {
    return {
      table: parseProductCsv(body.csv),
      kind: "sheet",
      ...fields,
    };
  }
  throw new Error("csv, xlsxBase64, pdfBase64, imageBase64, or multipart file required");
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(CLIENT_ROLES);
  if (error) return error;

  try {
    const { table, tariffCode: tc, country, shipmentValue, kind, vision } =
      await tableFromRequest(req);
    const tariffCode = tc || "STANDARD";
    const maxRows = maxPositionsForTariff(tariffCode as TariffCode);

    const parsedAll = mapCsvToRows(table.headers, table.rows);
    if (!parsedAll.length) {
      if (importPreviewAllowsEmptyRows(kind)) {
        return NextResponse.json({
          tariffCode,
          maxRows,
          rowCount: 0,
          rows: [],
          vision: vision || { attempted: true },
          notes: vision?.attempted
            ? "No product rows found on this image"
            : "vision not configured",
        });
      }
      return NextResponse.json(
        { error: "No product rows found; need a header row with name/наименование" },
        { status: 400 }
      );
    }
    // D10: keep first N for tariff. Over-max used to 400 and broke sample invoices under STANDARD.
    let truncated = false;
    let parsed = parsedAll;
    if (parsedAll.length > maxRows) {
      parsed = parsedAll.slice(0, maxRows);
      truncated = true;
    }

    const settings = await getPlatformSettings();
    const llmUrl = (process.env.LLM_SERVICE_URL || "").replace(/\/$/, "");
    const llmOn = settings.llmEnrichEnabled !== false && Boolean(llmUrl);

    const classified = await classifyImportRows(parsed, {
      findPrecedent: async (input) => {
        if (!llmOn) return null;
        const m = await findBestPrecedent(prisma, input);
        if (!m) return null;
        return { hsCode: m.hsCode, confidence: m.confidence, engine: m.engine };
      },
      classifyCascade: async (input) => {
        const d = await buildCascadeDraft(prisma, {
          name: input.name,
          description: input.description || input.name,
          title: input.name,
        });
        if (!d?.hsCode) return null;
        return {
          hsCode: d.hsCode,
          confidence: d.confidence,
          engine: d.engine || "cascade-v1",
        };
      },
      classifyLlm: async (input) => {
        if (!llmOn) return null;
        try {
          const res = await fetch(`${llmUrl}/v1/classify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: input.name,
              description: input.description || input.name,
              country,
            }),
            signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 8000)),
          });
          if (!res.ok) return null;
          const data = (await res.json()) as {
            hsCode?: string;
            confidence?: number;
            engine?: string;
          };
          if (!data.hsCode) return null;
          return {
            hsCode: data.hsCode,
            confidence: data.confidence ?? 0.6,
            engine: data.engine || "llm",
          };
        } catch {
          return null;
        }
      },
    });

    const originIso =
      resolveOriginCountryCode(String(country || "")) ||
      (String(country || "").trim().length === 2
        ? String(country).trim().toUpperCase()
        : null);
    const rows = classified.map((r) => ({
      ...r,
      attrs: enrichImportCreateAttrs(r, { country, originIso }),
    }));

    return NextResponse.json({
      tariffCode,
      maxRows,
      rowCount: rows.length,
      truncated: truncated || undefined,
      sourceCount: truncated ? parsedAll.length : undefined,
      summary: {
        matchedPrecedent: rows.filter((r) => r.rowStatus === "MATCHED_PRECEDENT").length,
        classifiedNew: rows.filter((r) => r.rowStatus === "CLASSIFIED_NEW").length,
        lowConfidence: rows.filter((r) => r.rowStatus === "LOW_CONFIDENCE").length,
        parseError: rows.filter((r) => r.rowStatus === "PARSE_ERROR").length,
      },
      rows,
      vision,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import preview failed" },
      { status: 400 }
    );
  }
}
