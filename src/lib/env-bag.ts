/**
 * Readable env bag — process.env or unit-test partials.
 * Prefer this over NodeJS.ProcessEnv in helpers that only read string keys.
 */
export type EnvBag = Record<string, string | undefined>;
