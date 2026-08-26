/**
 * Re-export curated HS aliases from domain lib (single source of truth).
 * JSON still lives next to this file for the lab asset path.
 */
export {
  HS_ALIASES,
  aliasByCode,
  matchAlias,
  normalizeQuery,
  scoreAlias,
  type HsAlias,
} from "@/lib/ved/tnved-aliases";
