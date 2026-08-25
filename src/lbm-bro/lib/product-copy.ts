import type { OrderDoc } from "./types";

export function productTitle(desc: string) {
  const raw = desc.trim() || "Без названия";
  const cut = raw.split(/\n+\s*Уточнения \(ИИ\):/)[0].trim();
  return (cut.split("\n")[0] || "Без названия").slice(0, 80);
}

export function clarifySummary(desc: string) {
  const answers = [...desc.matchAll(/Ответ:\s*(.+)/g)].map((m) => m[1].trim()).filter(Boolean);
  return answers.join(" · ");
}

const GENERIC_TITLE_RE = /^(товар|продукт|изделие|позиция|новый товар|без названия|новый|sample|item|product|widget|test)$/i;

const PRODUCT_HINT_RE = [
  "носк", "футбол", "кросс", "ноут", "laptop", "телефон", "смартфон", "фильтр", "ткан", "рубаш",
  "джинс", "курт", "сумк", "рюкзак", "игруш", "чай", "кофе", "шампун", "крем", "обув", "кед",
  "плать", "шорт", "худи", "поло", "майк", "sock", "shirt", "phone", "filter", "fabric",
  "toy", "bag", "shoe", "sneaker", "thinkpad", "iphone", "monitor", "телевиз",
  "бель", "постель", "простын", "одеял", "подуш", "bed", "linen", "duvet", "pillow",
];

/** Vague titles like «новый товар» — clarify answers may steer the code. */
export function isGenericProductTitle(title: string) {
  const t = (title || "").trim();
  if (!t || t.length < 3) return true;
  if (GENERIC_TITLE_RE.test(t)) return true;
  const low = t.toLowerCase().replace(/ё/g, "е");
  if (t.split(/\s+/).length <= 3 && !PRODUCT_HINT_RE.some((h) => low.includes(h))) return true;
  return false;
}

/** Text for HS classifier: product name + clarify answers (without question boilerplate). */
export function classificationText(desc: string) {
  const title = productTitle(desc);
  const answers = [...desc.matchAll(/Ответ:\s*(.+)/g)].map((m) => m[1].trim()).filter(Boolean);
  return [title, ...answers].filter(Boolean).join(" ");
}

function letterRatio(s: string) {
  const letters = (s.match(/[a-zA-Zа-яА-ЯёЁ0-9\s]/g) || []).length;
  return letters / Math.max(s.length, 1);
}

/** Reject noisy OCR (symbols, CJK junk, watermark garbage). */
export function isUsableProductHint(text: string) {
  const t = text.trim();
  if (t.length < 4) return false;
  if (letterRatio(t) < 0.55) return false;
  if (/\\/.test(t)) return false;
  const cjk = (t.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  if (cjk > 0 && cjk / t.length > 0.12) return false;
  if (/[©®™]/.test(t) && letterRatio(t) < 0.72) return false;
  return /(?:[a-zA-Zа-яА-ЯёЁ]{4,})/.test(t);
}

function ocrProductLines(text: string) {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => isUsableProductHint(l));
}

/** OCR and invoice rows from uploaded docs — for single-item classification. */
export function docClassificationHint(docs: OrderDoc[]): string {
  const bits: string[] = [];
  for (const d of docs) {
    const fromPhoto = d.kind === "photo";
    for (const line of d.packLines || []) {
      const name = line.name?.trim();
      if (!name || (fromPhoto && !isUsableProductHint(name))) continue;
      bits.push(name);
    }
    if (d.ocrText?.trim()) {
      bits.push(...ocrProductLines(d.ocrText));
      const compact = d.ocrText.replace(/\s+/g, " ").trim();
      if (compact.length <= 400 && isUsableProductHint(compact)) bits.push(compact);
    }
  }
  return [...new Set(bits)].join("\n").slice(0, 2000);
}

/** Include selected clarify chips in classifier input before they are merged into desc. */
export function mergeClarifyAnswers(desc: string, answers: Record<string, string>) {
  const vals = Object.values(answers).map((v) => v.trim()).filter(Boolean);
  if (!vals.length) return desc;
  if (/\n+\s*Уточнения \(ИИ\):/.test(desc)) return desc;
  const block = vals.map((ans, i) => `${i + 1}) Уточнение\nОтвет: ${ans}`).join("\n\n");
  return `${desc.trim()}\n\nУточнения (ИИ):\n${block}`;
}

/** Merge user description with OCR / invoice hints from attachments. */
export function buildClassificationQuery(desc: string, docs?: OrderDoc[]): string {
  const fromDocs = docs?.length ? docClassificationHint(docs) : "";
  const title = classificationText(desc);
  const plainTitle = productTitle(desc);
  const generic = isGenericProductTitle(plainTitle);
  const photoOnly = Boolean(docs?.length && docs.every((d) => d.kind === "photo"));
  // Block random OCR digits only when the user did not name the product (placeholder title + photo).
  if (generic && photoOnly && !fromDocs && GENERIC_TITLE_RE.test(plainTitle.trim())) {
    return "";
  }
  if (fromDocs && generic) return classificationText(fromDocs) || fromDocs;
  if (fromDocs && title) return `${title}\n${fromDocs}`;
  return title || fromDocs;
}
