/**
 * POST /api/v1/imports/products/preview — CSV/XLSX/PDF parse + per-row precedent/LLM classify.
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
  type SheetTable,
} from "@/lib/ved/product-import";
import {
  extractTableFromVisionImage,
  isImageFilename,
  sheetTableFromVisionItems,
  type VisionTableExtract,
} from "@/lib/ved/import-vision";
import { findBestPrecedent } from "@/lib/ved/verified-determinations";
import { buildCascadeDraft } from "@/lib/ved/tnved-classify";
import { maxPositionsForTariff } from "@/lib/ved/domain";
import { resolveOriginCountryCode } from "@/lib/ved/field-suggest";
import type { TariffCode } from "@prisma/client";

export const maxDuration = 120;

const jsonSchema = z.object({
  csv: z.string().min(1).max(500_000).optional(),
  xlsxBase64: z.string().min(1).max(2_000_000).optional(),
  pdfBase64: z.string().min(1).max(4_000_000).optional(),
  imageBase64: z.string().min(1).max(4_000_000).optional(),
  mimeType: z.string().max(80).optional(),
  filename: z.string().max(200).optional(),
  tariffCode: z.enum(["EXPRESS", "STANDARD", "PRO"]).optional(),
  country: z.string().optional(),
  shipmentValue: z.string().optional(),
});

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

async function tableFromVisionImage(
  imageBase64: string,
  mimeType?: string,
  filename?: string
): Promise<{ table: SheetTable; vision: VisionTableExtract | null }> {
  const vision = await extractTableFromVisionImage({
    imageBase64,
    mimeType,
    hint: filename,
  });
  if (!vision) return { table: { headers: [], rows: [] }, vision: null };
  return { table: sheetTableFromVisionItems(vision.items), vision };
}

async function tableFromRequest(req: NextRequest): Promise<{
  table: SheetTable;
  tariffCode?: string;
  country?: string;
  shipmentValue?: string;
  vision?: VisionTableExtract | null;
}> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("file required");
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "";
    let table: SheetTable;
    let vision: VisionTableExtract | null | undefined;
    if (isPdfFilename(file.name)) {
      table = await tableFromPdf(buf, file.name);
    } else if (isXlsxFilename(file.name)) {
      table = parseProductXlsx(buf);
    } else if (isImageFilename(file.name, mime)) {
      const fromImg = await tableFromVisionImage(buf.toString("base64"), mime || "image/jpeg", file.name);
      table = fromImg.table;
      vision = fromImg.vision;
    } else {
      table = parseProductCsv(buf.toString("utf8"));
    }
    return {
      table,
      vision,
      tariffCode: String(form.get("tariffCode") || "") || undefined,
      country: String(form.get("country") || "") || undefined,
      shipmentValue: String(form.get("shipmentValue") || "") || undefined,
    };
  }

  const body = jsonSchema.parse(await req.json());
  if (body.imageBase64) {
    const fromImg = await tableFromVisionImage(
      body.imageBase64,
      body.mimeType || "image/jpeg",
      body.filename
    );
    return {
      table: fromImg.table,
      vision: fromImg.vision,
      tariffCode: body.tariffCode,
      country: body.country,
      shipmentValue: body.shipmentValue,
    };
  }
  if (body.pdfBase64) {
    const buf = Buffer.from(body.pdfBase64, "base64");
    return {
      table: await tableFromPdf(buf, body.filename),
      tariffCode: body.tariffCode,
      country: body.country,
      shipmentValue: body.shipmentValue,
    };
  }
  if (body.xlsxBase64) {
    const buf = Buffer.from(body.xlsxBase64, "base64");
    return {
      table: parseProductXlsx(buf),
      tariffCode: body.tariffCode,
      country: body.country,
      shipmentValue: body.shipmentValue,
    };
  }
  if (body.csv) {
    return {
      table: parseProductCsv(body.csv),
      tariffCode: body.tariffCode,
      country: body.country,
      shipmentValue: body.shipmentValue,
    };
  }
  throw new Error("csv, xlsxBase64, pdfBase64, imageBase64, or multipart file required");
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(CLIENT_ROLES);
  if (error) return error;

  try {
    const { table, tariffCode: tc, country, shipmentValue, vision } = await tableFromRequest(req);
    const tariffCode = tc || "STANDARD";
    const maxRows = maxPositionsForTariff(tariffCode as TariffCode);

    const parsed = mapCsvToRows(table.headers, table.rows);
    if (!parsed.length && !vision) {
      return NextResponse.json(
        { error: "No product rows found; need a header row with name/наименование" },
        { status: 400 }
      );
    }
    if (parsed.length > maxRows) {
      return NextResponse.json(
        {
          error: `Too many rows (${parsed.length}); max ${maxRows} for tariff ${tariffCode}`,
        },
        { status: 400 }
      );
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
      kind: vision?.kind,
      notes: vision?.description,
      engine: vision?.engine,
      summary: {
        matchedPrecedent: rows.filter((r) => r.rowStatus === "MATCHED_PRECEDENT").length,
        classifiedNew: rows.filter((r) => r.rowStatus === "CLASSIFIED_NEW").length,
        lowConfidence: rows.filter((r) => r.rowStatus === "LOW_CONFIDENCE").length,
        parseError: rows.filter((r) => r.rowStatus === "PARSE_ERROR").length,
      },
      rows,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import preview failed" },
      { status: 400 }
    );
  }
}
