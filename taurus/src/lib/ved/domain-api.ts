/**
 * C1 Domain API — re-exports BFF proxy (`src/lib/ved/proxy.ts`).
 * Prefer importing from `@/lib/ved/proxy` for new code.
 */
export {
  proxyDomainApi,
  forwardDomainResponse,
  domainApiBase,
  isDomainApiEnabled,
  stripApiV1Prefix,
  handleBffProxy,
  mustStayOnNext,
} from "./proxy";
