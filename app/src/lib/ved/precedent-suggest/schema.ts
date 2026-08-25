import { z } from "zod";
import type { FieldSuggestKind } from "../field-suggest";

export const SUGGEST_KINDS = [
  "itemName",
  "partyDescription",
  "shipCountry",
  "originCountry",
  "material",
  "brand",
  "composition",
] as const satisfies readonly FieldSuggestKind[];

export const precedentSuggestRequestSchema = z.object({
  kind: z.enum(SUGGEST_KINDS),
  q: z.string().max(120).optional().default(""),
  limit: z.number().int().min(1).max(20).optional().default(8),
});

export type PrecedentSuggestRequest = z.infer<typeof precedentSuggestRequestSchema>;

export type PrecedentSuggestHit = {
  value: string;
  label?: string;
  source: "precedent" | "past_calc" | "local";
  score?: number;
};

export type PrecedentSuggestResponse = {
  engine: "precedent-suggest-v1";
  items: PrecedentSuggestHit[];
  rejected?: string;
};
