import { dutyRate } from "./payments";
import { aliasByCode, matchAlias } from "./hs-aliases";
import { formatHs, normalizeQuery as normalizeHsQuery } from "./hs-format";
import { TNVED_GROUPS } from "./tnved-groups";

export { formatHs, normalizeHsQuery };

export type HsRead = {
  hs: string;
  title: string;
  group: string;
  why: string;
  notes: string[];
  risk: string;
  dutyPct: number;
  fromCatalog: boolean;
  score: number;
};

/** @deprecated Use hs-aliases + tnved.json. Kept for catalogExtra compatibility. */
export const HS_CATALOG: { hs: string; title: string; group: string; why: string; notes: string[]; keys: string[]; exclude?: string[]; risk: string }[] = [];

export const HS_EXAMPLES = [
  { label: "Ноутбук", q: "ноутбук ThinkPad" },
  { label: "Футболка", q: "cotton t-shirt" },
  { label: "Поло", q: "mens polo shirt" },
  { label: "Фильтр", q: "oil filter automotive" },
  { label: "8471", q: "8471 30 000 0" },
];

function digits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function groupLabel(code: string) {
  const g = TNVED_GROUPS.find((x) => x[0] === code.slice(0, 2));
  return g ? `${g[0]} — ${g[1]}` : `${code.slice(0, 2)} — группа ТН ВЭД`;
}

export function confFromScore(score: number, fromCatalog: boolean) {
  if (!fromCatalog) return 70;
  return Math.min(96, 78 + Math.min(18, Math.floor(score / 10)));
}

export function readHs(query: string): HsRead | null {
  const raw = query.trim();
  if (!raw) return null;
  const d = digits(raw);

  if (d.length >= 4) {
    const hs = formatHs(d);
    const alias = aliasByCode(d);
    const pct = Math.round(dutyRate(hs) * 100);
    if (alias && d.length >= 10) {
      return {
        hs,
        title: `Код ${hs}`,
        group: groupLabel(d),
        why: "Полная расшифровка — в справочнике ТН ВЭД или в заявке после просчёта.",
        notes: [`Ориентир пошлины ${pct}%`, "НДС 20% считают в заявке"],
        risk: alias.risk,
        dutyPct: pct,
        fromCatalog: true,
        score: 80,
      };
    }
    return {
      hs,
      title: "Позиция классификатора ТН ВЭД ЕАЭС",
      group: groupLabel(d),
      why: "Код можно читать бесплатно: группа, ориентир пошлины и что обычно спрашивает таможня. Это не официальное решение ФТС.",
      notes: [`Ориентир пошлины ${pct}%`, "НДС 20% считают в заявке", "Для PDF и брокера оформите платный просчёт"],
      risk: "Уточните описание товара",
      dutyPct: pct,
      fromCatalog: false,
      score: 20,
    };
  }

  const hit = matchAlias(raw);
  if (!hit) return null;
  const hs = formatHs(hit.alias.code);
  const pct = Math.round(dutyRate(hs) * 100);
  return {
    hs,
    title: hit.alias.why.split(".")[0],
    group: groupLabel(hit.alias.code),
    why: hit.alias.why,
    notes: [`Ориентир пошлины ${pct}%`, "НДС 20% считают в заявке"],
    risk: hit.alias.risk,
    dutyPct: pct,
    fromCatalog: true,
    score: hit.score,
  };
}

export function previewCode(text: string) {
  const hit = readHs(text);
  if (!hit) {
    return { hs: "— — —", title: "Код появится после описания", conf: 0 };
  }
  return { hs: hit.hs, title: hit.title, conf: confFromScore(hit.score, hit.fromCatalog) };
}
