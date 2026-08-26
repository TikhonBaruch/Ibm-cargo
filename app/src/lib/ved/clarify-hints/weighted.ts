/**
 * Build clarify questions with DB option/edge weights (P2). Falls back to code map.
 */
import type { PrismaClient } from "@prisma/client";
import type { ClarificationQuestion, HeuristicClarifyInput } from "./types";
import { heuristicClarificationQuestions } from "./questions";
import { applyEdgeWeights, applyOptionWeights } from "./learning";
import { detectCategory } from "./detect";

type Db = Pick<
  PrismaClient,
  "clarifyAttributeOption" | "clarifyDependencyEdge"
>;

export async function weightedClarificationQuestions(
  db: Db,
  input: HeuristicClarifyInput
): Promise<ClarificationQuestion[]> {
  const base = heuristicClarificationQuestions(input);
  if (!base.length) return base;

  const category = detectCategory(input.desc || "");
  const orderedIds = await applyEdgeWeights(
    db,
    category,
    base.map((q) => q.id)
  );
  const byId = new Map(base.map((q) => [q.id, q]));
  const ordered = orderedIds.map((id) => byId.get(id)!).filter(Boolean);
  // Keep any questions missing from edge map
  for (const q of base) {
    if (!ordered.some((o) => o.id === q.id)) ordered.push(q);
  }

  const out: ClarificationQuestion[] = [];
  for (const q of ordered.slice(0, 3)) {
    if (q.options?.length) {
      const options = await applyOptionWeights(db, category, q.id, q.options);
      out.push({ ...q, options });
    } else {
      out.push(q);
    }
  }
  return out;
}
