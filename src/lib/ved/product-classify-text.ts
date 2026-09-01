/**
 * Text helpers for TN VED classify (ported from lab product-copy, server-only).
 */

const GENERIC_TITLE_RE = /^(товар|продукт|изделие|позиция|новый товар|без названия|новый|sample|item|product|widget|test)$/i;

const PRODUCT_HINT_RE = [
  "носк", "футбол", "кросс", "ноут", "laptop", "телефон", "смартфон", "фильтр", "tкан", "рубаш",
  "джинс", "курт", "сумк", "рюкзак", "игруш", "чай", "кофе", "шампун", "крем", "обув", "кед",
  "плать", "шорт", "худи", "поло", "майк", "sock", "shirt", "phone", "filter", "fabric",
  "toy", "bag", "shoe", "sneaker", "thinkpad", "iphone", "monitor", "телевиз",
  "бель", "постель", "простын", "одеял", "подуш", "bed", "linen", "duvet", "pillow",
];

export function productTitle(desc: string) {
  const raw = desc.trim() || "Без названия";
  const cut = raw.split(/\n+\s*Уточнения \(ИИ\):/)[0].trim();
  return (cut.split("\n")[0] || "Без названия").slice(0, 80);
}

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

/** Build classify query from description + optional server OCR text. */
export function buildClassificationQuery(
  desc: string,
  opts: { ocrText?: string | null } = {}
): string {
  const fromOcr = opts.ocrText?.trim() || "";
  const ocrBits = fromOcr ? ocrProductLines(fromOcr) : [];
  const ocrCompact =
    fromOcr && fromOcr.replace(/\s+/g, " ").trim().length <= 400 && isUsableProductHint(fromOcr)
      ? [fromOcr.replace(/\s+/g, " ").trim()]
      : [];
  const fromDocs = [...ocrBits, ...ocrCompact].filter(Boolean).join("\n");
  const title = classificationText(desc);
  const plainTitle = productTitle(desc);
  const generic = isGenericProductTitle(plainTitle);
  if (generic && !fromDocs && GENERIC_TITLE_RE.test(plainTitle.trim())) return "";
  if (fromDocs && generic) return classificationText(fromDocs) || fromDocs;
  if (fromDocs && title) return `${title}\n${fromDocs}`;
  return title || fromDocs;
}
