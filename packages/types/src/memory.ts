import type { Action, Decision } from "./decision.ts";
import type { Mint, Timestamp } from "./token.ts";
import type { ExitReason } from "./trade.ts";

/**
 * The agent's long-term memory of a single completed trade episode. This is
 * what the agent learns from: the conditions it saw, what it decided, and
 * how that turned out. Recalled into future decision contexts.
 */
export interface TradeMemory {
  readonly id: string;
  readonly mint: Mint;
  readonly symbol: string;
  /** Snapshot of the decision that opened the position. */
  readonly decision: Pick<Decision, "action" | "confidence" | "expectedReward" | "expectedRisk" | "reasoning" | "engine">;
  /** Conditions at entry, flattened for similarity matching. */
  readonly entryConditions: MarketFingerprint;
  readonly outcome: TradeOutcome | null;
  readonly createdAt: Timestamp;
}

/**
 * A compact, comparable fingerprint of market conditions. Used to recall
 * "what happened last time conditions looked like this".
 */
export interface MarketFingerprint {
  readonly riskScore: number;
  readonly liquidityUsd: number;
  readonly volumeH1: number;
  readonly priceChangeH1: number;
  readonly holderCount: number | null;
  readonly discoverySource: string;
  readonly tokenAgeMinutes: number | null;
}

/** How a remembered trade resolved. */
export interface TradeOutcome {
  readonly realizedPnlSol: number;
  readonly realizedPnlPct: number;
  readonly holdMinutes: number;
  readonly exitReason: ExitReason;
  /** Coarse label for fast pattern queries. */
  readonly result: "win" | "loss" | "breakeven";
}

/** A learned pattern aggregated across many memories. */
export interface LearnedPattern {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly sampleSize: number;
  readonly winRate: number;
  readonly avgPnlPct: number;
  /** Action this pattern recommends when matched. */
  readonly recommends: Action;
  readonly updatedAt: Timestamp;
}
