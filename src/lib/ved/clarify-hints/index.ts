export type {
  CategoryId,
  ClarificationQuestion,
  ClarifyAnswers,
  ClarifyOption,
  HeuristicClarifyInput,
} from "./types";

export {
  CUSTOM_OPTION_ID,
  withCustomOption,
  COMPOSITION,
  KNIT_WOVEN,
  COLOR,
  FOOTWEAR_UPPER,
  FOOTWEAR_SOLE,
  FOOTWEAR_PURPOSE,
  CONDITION,
  APPLIANCE_CONDITION,
  MATERIAL,
  BAG_MATERIAL,
  BAG_KIND,
  COSMETIC_KIND,
  ACCESSORY_MATERIAL,
  TOY_MATERIAL,
  TOY_AGE,
  SPORTS_KIND,
  HOME_MATERIAL,
  HOME_KIND,
  TOOL_KIND,
  FOOD_KIND,
  FOOD_CERT,
  BABY_KIND,
  BABY_AGE,
  GENERIC_BRAND_KIND,
  GENERIC_KIND,
  TEXTILE_DENSITY,
  TEXTILE_WIDTH,
  ELECTRONICS_SPECS,
  LAPTOP_SIZE,
  APPLIANCE_POWER,
  YES_NO_DOCS,
  YES_NO,
  CODE_SCOPE,
  APPAREL_GENDER,
  APPAREL_GARMENT,
  ELECTRONICS_DEVICE,
  AUTO_PART_TYPE,
  COSMETIC_FORM,
  COSMETIC_VOLUME,
  FOOD_PACKAGING,
  FOOD_ORIGIN,
  HOME_DISHES,
  HOME_TEXTILE,
} from "./options";

export {
  detectCategory,
  detectComposition,
  detectFootwearUpper,
  detectFootwearSole,
  detectColor,
  detectBrand,
  coreReady,
  gapTipLabels,
  CATEGORY_KEYS,
  hasAnyClarify,
  matchesClarify,
  normalizeClarifyText,
} from "./detect";

export {
  questionsForCategory,
  truncateClarifyQuestions,
  heuristicClarificationQuestions,
  newCalcClarifyQuestions,
  normalizeQuestion,
} from "./questions";

export {
  mergeSearchTokens,
  applyAttrsPatches,
  buildEnrichedHsQuery,
  patchForClarifyAnswer,
} from "./answers";

export {
  recordClarifyFeedbackFromApprove,
  reweightClarifyHints,
  searchClarifyProductProfiles,
  applyOptionWeights,
  applyEdgeWeights,
  extractClarifyAnswersFromText,
} from "./learning";

export { weightedClarificationQuestions } from "./weighted";
