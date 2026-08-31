/**
 * Cabinet UI feature flags. Domain/API code stays; hide surfaces until go-live.
 * Set NEXT_PUBLIC_SHIPPING_UI=1 (or SHIPPING_UI=1) to re-enable client shipping pane.
 *
 * NEXT_PUBLIC_* must be read via literal `process.env.NEXT_PUBLIC_…` so Next.js
 * inlines values into the client bundle. Dynamic `env[key]` stays undefined on the client.
 */
function isTruthyFlag(raw: string | undefined, defaultValue = "0"): boolean {
  const v = (raw ?? defaultValue).toLowerCase();
  return v === "1" || v === "true";
}

export function shippingUiEnabled(
  env?: Record<string, string | undefined>
): boolean {
  if (env) {
    return isTruthyFlag(env.NEXT_PUBLIC_SHIPPING_UI ?? env.SHIPPING_UI);
  }
  return isTruthyFlag(process.env.NEXT_PUBLIC_SHIPPING_UI ?? process.env.SHIPPING_UI);
}

export function factoryUiEnabled(
  env?: Record<string, string | undefined>
): boolean {
  if (env) {
    return isTruthyFlag(env.NEXT_PUBLIC_FACTORY_UI ?? env.FACTORY_UI);
  }
  return isTruthyFlag(process.env.NEXT_PUBLIC_FACTORY_UI ?? process.env.FACTORY_UI);
}

/**
 * Designer-styled chrome for factory / manufacturer (home tile, admin nav,
 * clients filter). Temporarily off for the visual study (C6).
 * Domain/API and deep-link `/cabinet/factory` stay.
 * Restore: `return factoryUiEnabled(env)`.
 */
export function designerManufacturerChromeEnabled(
  env?: Record<string, string | undefined>
): boolean {
  void env;
  return false;
}

/**
 * Invoice value, line qty, unit price, and net weight in cabinet UI (C8).
 * Domain/API fields stay optional. Tariff priceRub and duty/VAT stay visible.
 * Restore: `return true`.
 */
export function commercialInvoiceUiEnabled(
  env?: Record<string, string | undefined>
): boolean {
  void env;
  return false;
}
