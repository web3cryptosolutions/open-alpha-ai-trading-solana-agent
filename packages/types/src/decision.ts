import type { Mint, Timestamp } from "./token.ts";

/** The four actions the decision engine may emit. */
export type Action = "BUY" | "SELL" | "WATCH" | "IGNORE";

/**
 * The agent's decision about a token at a moment in time. This is the single
 * most important artifact in the system — it is the contract between "thinking"
 * and "acting", and it is fully explainable by construction.
 */
export interface Decision {
  readonly mint: Mint;
  readonly action: Action;
  /** Confidence in the action, 0..1. */
  readonly confidence: number;
  /** The risk score (0..100) this decision was made under. */
  readonly riskScore: number;
  /** The risk band this decision was made under. */
  readonly riskLevel: import("./risk.ts").RiskLevel;
  /** Expected downside risk if acted upon, 0..1 (1 = could lose everything). */
  readonly expectedRisk: number;
  /** Expected upside as a multiple (1.5 = +50% expected). */
  readonly expectedReward: number;
  /**
   * A reward/risk ratio the engine computed. Surfaced separately so strategies
   * and the UI can sort/threshold on it without recomputing.
   */
  readonly rewardRiskRatio: number;
  /** Plain-language reasoning. For LLM engines this is the model's rationale. */
  readonly reasoning: string;
  /** Short bullet factors that drove the decision, for compact UI display. */
  readonly factors: readonly string[];
  /** Which engine produced this (e.g. "rules:v1", "claude:opus-4-8"). */
  readonly engine: string;
  readonly decidedAt: Timestamp;
}

/** The bundle of evidence handed to a decision engine. */
export interface DecisionContext {
  readonly mint: Mint;
  readonly discovery: import("./discovery.ts").DiscoverySignal;
  readonly market: import("./token.ts").MarketSnapshot;
  readonly risk: import("./risk.ts").RiskReport;
  /** Relevant prior outcomes recalled from memory, newest first. */
  readonly memories: readonly import("./memory.ts").TradeMemory[];
  /** Hard guardrails the engine must respect. */
  readonly guardrails: Guardrails;
}

/** Non-negotiable limits enforced around every decision. */
export interface Guardrails {
  readonly maxPositionSol: number;
  readonly maxOpenPositions: number;
  readonly minRiskScoreToTrade: number;
  readonly dailyLossLimitSol: number;
}
