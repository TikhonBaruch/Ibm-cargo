/**
 * Lab UI adapter: shared clarify-hints options with `value` = searchValue.
 */
import type { ClarifyOption as SharedOption } from "@/lib/ved/clarify-hints";
import { CUSTOM_OPTION_ID as SHARED_CUSTOM, withCustomOption as sharedWithCustom } from "@/lib/ved/clarify-hints";
import * as shared from "@/lib/ved/clarify-hints";

export type ClarifyOption = { id: string; label: string; value: string };

export const CUSTOM_OPTION_ID = SHARED_CUSTOM;

function toUi(o: SharedOption): ClarifyOption {
  return { id: o.id, label: o.label, value: o.searchValue };
}

function toUiList(list: SharedOption[]): ClarifyOption[] {
  return list.map(toUi);
}

export function withCustomOption(options: ClarifyOption[]): ClarifyOption[] {
  return sharedWithCustom(options.map((o) => ({ id: o.id, label: o.label, searchValue: o.value }))).map(
    toUi
  );
}

export const COMPOSITION = toUiList(shared.COMPOSITION);
export const KNIT_WOVEN = toUiList(shared.KNIT_WOVEN);
export const COLOR = toUiList(shared.COLOR);
export const FOOTWEAR_UPPER = toUiList(shared.FOOTWEAR_UPPER);
export const FOOTWEAR_SOLE = toUiList(shared.FOOTWEAR_SOLE);
export const FOOTWEAR_PURPOSE = toUiList(shared.FOOTWEAR_PURPOSE);
export const CONDITION = toUiList(shared.CONDITION);
export const APPLIANCE_CONDITION = toUiList(shared.APPLIANCE_CONDITION);
export const MATERIAL = toUiList(shared.MATERIAL);
export const BAG_MATERIAL = toUiList(shared.BAG_MATERIAL);
export const BAG_KIND = toUiList(shared.BAG_KIND);
export const COSMETIC_KIND = toUiList(shared.COSMETIC_KIND);
export const ACCESSORY_MATERIAL = toUiList(shared.ACCESSORY_MATERIAL);
export const TOY_MATERIAL = toUiList(shared.TOY_MATERIAL);
export const TOY_AGE = toUiList(shared.TOY_AGE);
export const SPORTS_KIND = toUiList(shared.SPORTS_KIND);
export const HOME_MATERIAL = toUiList(shared.HOME_MATERIAL);
export const HOME_KIND = toUiList(shared.HOME_KIND);
export const TOOL_KIND = toUiList(shared.TOOL_KIND);
export const FOOD_KIND = toUiList(shared.FOOD_KIND);
export const FOOD_CERT = toUiList(shared.FOOD_CERT);
export const BABY_KIND = toUiList(shared.BABY_KIND);
export const BABY_AGE = toUiList(shared.BABY_AGE);
export const GENERIC_BRAND_KIND = toUiList(shared.GENERIC_BRAND_KIND);
export const GENERIC_KIND = toUiList(shared.GENERIC_KIND);
export const TEXTILE_DENSITY = toUiList(shared.TEXTILE_DENSITY);
export const TEXTILE_WIDTH = toUiList(shared.TEXTILE_WIDTH);
export const ELECTRONICS_SPECS = toUiList(shared.ELECTRONICS_SPECS);
export const LAPTOP_SIZE = toUiList(shared.LAPTOP_SIZE);
export const APPLIANCE_POWER = toUiList(shared.APPLIANCE_POWER);
export const YES_NO_DOCS = toUiList(shared.YES_NO_DOCS);
export const YES_NO = toUiList(shared.YES_NO);
export const CODE_SCOPE = toUiList(shared.CODE_SCOPE);
export const APPAREL_GENDER = toUiList(shared.APPAREL_GENDER);
export const APPAREL_GARMENT = toUiList(shared.APPAREL_GARMENT);
export const ELECTRONICS_DEVICE = toUiList(shared.ELECTRONICS_DEVICE);
export const AUTO_PART_TYPE = toUiList(shared.AUTO_PART_TYPE);
export const COSMETIC_FORM = toUiList(shared.COSMETIC_FORM);
export const COSMETIC_VOLUME = toUiList(shared.COSMETIC_VOLUME);
export const FOOD_PACKAGING = toUiList(shared.FOOD_PACKAGING);
export const FOOD_ORIGIN = toUiList(shared.FOOD_ORIGIN);
export const HOME_DISHES = toUiList(shared.HOME_DISHES);
export const HOME_TEXTILE = toUiList(shared.HOME_TEXTILE);
