/**
 * Broker "thin dossier" helper: AI weak + manufacturer catalog empty.
 * Gaps drive chat request + approve warn; empty attrs may be filled via mapping (plan-broker-empty-attrs).
 */

export type DossierGapId =
  | "low-confidence"
  | "hs-short"
  | "weight"
  | "composition"
  | "volume"
  | "identity";

export type DossierGap = {
  id: DossierGapId;
  label: string;
  severity: "critical" | "helpful";
};

export type DossierSpecialFlag = "alcohol" | "engine" | "parts" | "volume";

export const DOSSIER_SPECIAL_LABELS: Record<DossierSpecialFlag, string> = {
  alcohol: "спирт / спиртосодержащее",
  engine: "двигатель (тип, см³ / кВт)",
  parts: "отдельно декларируемые части или комплекты",
  volume: "габариты или объём (м³)",
};

type ItemLike = {
  name?: string;
  attrs?: {
    brand?: string;
    material?: string;
    composition?: string;
    netWeightKg?: number;
    grossWeightKg?: number;
    technicalSpecs?: string;
    extra?: Record<string, string>;
  } | null;
};

export type BrokerDossierInput = {
  confidence?: number | null;
  hsCode?: string | null;
  items?: ItemLike[];
  confidenceThreshold?: number;
};

export type BrokerDossierAnalysis = {
  gaps: DossierGap[];
  thin: boolean;
  needsComment: boolean;
};

function hsDigits(code?: string | null): string {
  return (code || "").replace(/\D/g, "");
}

export function analyzeBrokerDossier(input: BrokerDossierInput): BrokerDossierAnalysis {
  const threshold = input.confidenceThreshold ?? 0.75;
  const items = input.items?.length ? input.items : [];
  const gaps: DossierGap[] = [];

  const conf = input.confidence;
  if (conf == null || !Number.isFinite(conf) || conf < threshold) {
    gaps.push({
      id: "low-confidence",
      label: "AI не уверен в коде (низкий confidence или нет черновика)",
      severity: "critical",
    });
  }

  const digits = hsDigits(input.hsCode);
  if (digits.length > 0 && digits.length < 8) {
    gaps.push({
      id: "hs-short",
      label: "Код AI короче 8 знаков — нужна уточнённая позиция",
      severity: "critical",
    });
  }

  const hasWeight = items.some(
    (it) => it.attrs?.netWeightKg != null || it.attrs?.grossWeightKg != null
  );
  if (items.length === 0 || !hasWeight) {
    gaps.push({
      id: "weight",
      label: "Нет веса (нетто / брутто)",
      severity: "critical",
    });
  }

  const hasComposition = items.some(
    (it) =>
      Boolean(it.attrs?.material?.trim()) ||
      Boolean(it.attrs?.composition?.trim()) ||
      Boolean(it.attrs?.technicalSpecs?.trim())
  );
  if (items.length === 0 || !hasComposition) {
    gaps.push({
      id: "composition",
      label: "Нет состава / материала / тех. описания",
      severity: "critical",
    });
  }

  const hasVolume = items.some((it) => {
    const extra = it.attrs?.extra || {};
    return Boolean(extra.volumeM3?.trim() || extra.dimsCm?.trim() || extra.volume?.trim());
  });
  if (!hasVolume) {
    gaps.push({
      id: "volume",
      label: "Нет габаритов / объёма",
      severity: "helpful",
    });
  }

  const hasIdentity = items.some((it) => Boolean(it.attrs?.brand?.trim()));
  if (!hasIdentity) {
    gaps.push({
      id: "identity",
      label: "Нет бренда / модели (производитель не в каталоге)",
      severity: "helpful",
    });
  }

  const thin = gaps.some((g) => g.severity === "critical");
  return { gaps, thin, needsComment: thin };
}

export function buildDossierRequestMessage(
  analysis: BrokerDossierAnalysis,
  flags: DossierSpecialFlag[] = []
): string {
  const lines = analysis.gaps.map((g) => `• ${g.label}`);
  const special = flags.map((f) => `• уточните: ${DOSSIER_SPECIAL_LABELS[f]}`);
  return [
    "Для точного кода ТН ВЭД и сметы не хватает данных (ИИ не справился, эталона производителя в базе нет).",
    "Пожалуйста, пришлите:",
    ...lines,
    ...(special.length ? ["Также нужно знать:", ...special] : []),
    "Без этого классификация будет ориентировочной.",
  ].join("\n");
}
