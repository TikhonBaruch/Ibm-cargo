#!/usr/bin/env node
/**
 * RETIRED (D36): LBM must not sync from nested ./llm or taurus/llm.
 * containers/{llm,ocr} are LBM-owned Compose services — edit them in LBM PRs.
 * External matrix = HTTP only (*_SERVICE_URL).
 *
 * Kept as npm script stub so old docs/muscle-memory do not reintroduce coupling.
 */
console.log(
  "sync-ai-matrix: retired (D36). No nested ./llm coupling — containers/{llm,ocr} are LBM-owned; matrix = HTTP only."
);
process.exit(0);
