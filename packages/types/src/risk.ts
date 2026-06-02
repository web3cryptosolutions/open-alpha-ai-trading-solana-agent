import type { Mint, Timestamp } from "./token.ts";

/** Coarse risk band derived from the numeric score. */
export type RiskLevel = "safe" | "caution" | "danger";

/** Every check votes in one of these directions. */
export type CheckVerdict = "pass" | "warn" | "fail" | "unknown";

/** Stable identifiers for each risk check so UIs and tests can key off them. */
export type RiskCheckId =
  | "mint-authority"
  | "freeze-authority"
  | "liquidity-amount"
  | "liquidity-locked"
  | "lp-concentration"
  | "holder-concentration"
  | "dev-holdings"
  | "bundled-wallets"
  | "wallet-clustering"
  | "rug-history"
  | "token-age"
  | "liquidity-age";

/**
 * The result of a single risk check. Each check is independent and
 * explainable: it returns a verdict, a 0..1 severity contribution, and a
 * sentence a human can read. `weight` lets the engine compose checks without
 * the checks knowing about each other.
 */
export interface RiskCheckResult {
  readonly id: RiskCheckId;
  readonly label: string;
  readonly verdict: CheckVerdict;
  /** 0 = no concern, 1 = maximal concern. `unknown` checks use `null`. */
  readonly severity: number | null;
  /** Relative importance of this check when composing the final score. */
  readonly weight: number;
  /** One sentence explaining the verdict, with the observed value inline. */
  readonly detail: string;
}

/**
 * A full risk assessment for a token. Score is 0..100 where 100 is safest.
 * The level is a band over the score, and the report always carries the
 * individual check results so nothing is a black box.
 */
export interface RiskReport {
  readonly mint: Mint;
  /** 0 (most dangerous) .. 100 (safest). */
  readonly score: number;
  readonly level: RiskLevel;
  readonly checks: readonly RiskCheckResult[];
  /** The checks that most dragged the score down, pre-sorted. */
  readonly topConcerns: readonly RiskCheckResult[];
  readonly assessedAt: Timestamp;
}
