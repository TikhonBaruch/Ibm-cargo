import { parseDelimited, parseInvoiceText, linesFromPdfItems, type PackRow } from "./pack-rows";
import { parseXlsxBuffer } from "./pack-xlsx";

export type PackReadSource = "csv" | "xlsx" | "pdf" | "ocr";

export type PackExtract = {
  rows: PackRow[];
  source?: PackReadSource;
  ocrText?: string;
};

type StatusFn = (message: string, pct?: number) => void;

let ocrWorker: Promise<OcrWorker> | null = null;
let ocrStatus: StatusFn | undefined;

type OcrWorker = {
  recognize: (image: HTMLCanvasElement | File | Blob, opts?: object) => Promise<{ data: { text: string } }>;
};

function isCsv(name: string, mime: string) {
  return /\.(csv|tsv|txt)$/i.test(name) || /csv|tab-separated|text\/plain/i.test(mime);
}

function isXlsx(name: string, mime: string) {
  return /\.xlsx$/i.test(name) || /spreadsheetml|officedocument\.spreadsheet/i.test(mime);
}

function isXls(name: string) {
  return /\.xls$/i.test(name) && !/\.xlsx$/i.test(name);
}

function isPdf(name: string, mime: string) {
  return /\.pdf$/i.test(name) || mime === "application/pdf";
}

function isImage(name: string, mime: string) {
  return mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(name);
}

export async function extractPackFromFile(file: File, onStatus?: StatusFn): Promise<PackExtract> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { rows: [] };
  }
  const name = file.name;
  const mime = file.type || "";

  if (isCsv(name, mime)) {
    onStatus?.("Читаем таблицу…");
    try {
      const rows = parseDelimited(await file.text());
      return { rows, source: rows.length ? "csv" : undefined };
    } catch {
      return { rows: [] };
    }
  }

  if (isXlsx(name, mime)) {
    onStatus?.("Читаем Excel…");
    try {
      const rows = parseXlsxBuffer(new Uint8Array(await file.arrayBuffer()));
      return { rows, source: rows.length ? "xlsx" : undefined };
    } catch {
      return { rows: [] };
    }
  }

  if (isXls(name)) {
    onStatus?.("Старый .xls не читается — сохраните как .xlsx или CSV");
    return { rows: [] };
  }

  if (isPdf(name, mime)) {
    try {
      return await readPdf(file, onStatus);
    } catch {
      return { rows: [] };
    }
  }

  if (isImage(name, mime)) {
    onStatus?.("Распознаём фото…", 5);
    try {
      const canvas = await imageToCanvas(file);
      const text = await ocrCanvas(canvas, onStatus);
      const rows = parseInvoiceText(text);
      return { rows, source: rows.length ? "ocr" : undefined, ocrText: text.trim() || undefined };
    } catch {
      return { rows: [] };
    }
  }

  onStatus?.("Пробуем прочитать как текст…");
  try {
    const text = await file.text();
    if (text && /[\x00-\x08]/.test(text.slice(0, 80))) return { rows: [] };
    const rows = parseDelimited(text);
    if (rows.length) return { rows, source: "csv" };
    const fromText = parseInvoiceText(text);
    return { rows: fromText, source: fromText.length ? "csv" : undefined };
  } catch {
    return { rows: [] };
  }
}

async function readPdf(file: File, onStatus?: StatusFn): Promise<PackExtract> {
  onStatus?.("Читаем PDF…", 8);
  const pdfjs = await import("pdfjs-dist");
  const version = pdfjs.version || "6.2.108";
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = Math.min(doc.numPages, 6);
  const textPages: string[] = [];
  for (let i = 1; i <= pageCount; i += 1) {
    onStatus?.(`Читаем PDF, стр. ${i} из ${pageCount}…`, Math.round((i / pageCount) * 40));
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items as { str?: string; transform?: number[] }[])
      .filter((it) => typeof it.str === "string" && it.transform)
      .map((it) => ({ str: it.str || "", x: it.transform![4], y: it.transform![5] }));
    textPages.push(linesFromPdfItems(items).join("\n"));
  }
  const fromText = parseInvoiceText(textPages.join("\n"));
  if (fromText.length >= 2) {
    return { rows: fromText, source: "pdf" };
  }

  const ocrBits: string[] = [];
  for (let i = 1; i <= pageCount; i += 1) {
    onStatus?.(`Распознаём PDF, стр. ${i} из ${pageCount}…`, 40 + Math.round((i / pageCount) * 55));
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.2, 2000 / Math.max(base.width, 1));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    ocrBits.push(await ocrCanvas(canvas, onStatus));
  }
  const fromOcr = parseInvoiceText(ocrBits.join("\n"));
  return { rows: fromOcr.length ? fromOcr : fromText, source: fromOcr.length ? "ocr" : fromText.length ? "pdf" : undefined };
}

async function imageToCanvas(file: File) {
  const bmp = await createImageBitmap(file);
  const maxSide = 2000;
  const scale = Math.min(maxSide / Math.max(bmp.width, bmp.height), 2.4);
  const w = Math.max(1, Math.round(bmp.width * Math.max(scale, 1)));
  const h = Math.max(1, Math.round(bmp.height * Math.max(scale, 1)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.min(255, Math.max(0, (y - 18) * 1.28));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function getOcrWorker(onStatus?: StatusFn) {
  ocrStatus = onStatus;
  if (!ocrWorker) {
    ocrWorker = (async () => {
      ocrStatus?.("Загружаем OCR…", 10);
      const tesseract = await import("tesseract.js");
      const createWorker = tesseract.createWorker
        || (tesseract as { default?: { createWorker?: typeof tesseract.createWorker } }).default?.createWorker;
      if (!createWorker) throw new Error("tesseract");
      try {
        return await createWorker(["eng", "rus", "chi_sim"], 1, {
          logger: (m: { status?: string; progress?: number }) => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              ocrStatus?.("Распознаём текст…", Math.round(12 + m.progress * 80));
            } else if (m.status?.includes("loading") || m.status?.includes("loaded") || m.status?.includes("download")) {
              ocrStatus?.("Загружаем языки OCR…", 15);
            }
          },
        }) as unknown as OcrWorker;
      } catch {
        return await createWorker("eng", 1) as unknown as OcrWorker;
      }
    })();
  }
  return ocrWorker;
}

async function ocrCanvas(image: HTMLCanvasElement, onStatus?: StatusFn) {
  const worker = await getOcrWorker(onStatus);
  const { data } = await worker.recognize(image);
  return data.text || "";
}
