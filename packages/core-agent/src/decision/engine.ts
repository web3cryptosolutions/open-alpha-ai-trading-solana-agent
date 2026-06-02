import type { Decision, DecisionContext, StrategyProposal } from "@openalpha/types";

/**
 * The decision boundary. Given the full evidence bundle and the strategies'
 * proposals, produce one explainable `Decision`. Implementations range from a
 * deterministic rules engine to an LLM — all interchangeable, all required to
 * return the same explainable artifact.
 */
export interface DecisionEngine {
  readonly id: string;
  decide(ctx: DecisionContext, proposals: readonly StrategyProposal[]): Promise<Decision>;
}

/** Shared helpers for engines so explanations stay consistent. */
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const round = (x: number, dp = 4): number => Number(x.toFixed(dp));
