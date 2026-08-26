import type { ProductAttrs } from "../product-description";

export type CategoryId =
  | "footwear"
  | "apparel"
  | "textiles"
  | "electronics"
  | "appliances"
  | "auto"
  | "cosmetics"
  | "bags"
  | "accessories"
  | "toys"
  | "sports"
  | "home"
  | "tools"
  | "food"
  | "baby"
  | "generic";

/** Chip option: searchValue feeds HS ranking; attrsPatch fills ProductAttrs (empty-only). */
export type ClarifyOption = {
  id: string;
  label: string;
  /** Keywords for HS classifier / aliases (not a pretty label). */
  searchValue: string;
  attrsPatch?: ProductAttrs;
  hsHint?: string;
};

export type ClarificationQuestion = {
  id: string;
  text: string;
  required: boolean;
  hint?: string;
  kind?: "choice" | "text";
  options?: ClarifyOption[];
  allowCustom?: boolean;
};

export type ClarifyAnswers = Record<string, string>;

export type HeuristicClarifyInput = {
  desc: string;
  hasDocs?: boolean;
  /** Lab wizard step-2 price / tariff questions. NewCalc omits. */
  includeDocsQuestion?: boolean;
  includePriceQuestions?: boolean;
  price?: string;
  tariff?: string;
  step?: 1 | 2;
};
