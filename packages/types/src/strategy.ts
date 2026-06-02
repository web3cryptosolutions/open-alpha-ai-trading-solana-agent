import type { Action } from "./decision.ts";
import type { ExitPlan } from "./trade.ts";
import type { MarketSnapshot } from "./token.ts";
import type { RiskReport } from "./risk.ts";
import type { DiscoverySignal } from "./discovery.ts";

/**
 * The input a strategy reasons over. Strategies are pure-ish functions of
 * this context — given the same context they should produce the same proposal,
 * which is what makes them backtestable.
 */
export interface StrategyContext {
  readonly discovery: DiscoverySignal;
  readonly market: MarketSnapshot;
  readonly risk: RiskReport;
}

/**
 * A strategy's opinion. Strategies do not execute and do not size against the
 * whole portfolio — they propose. The core agent reconciles proposals from
 * multiple strategies, applies guardrails, and decides.
 */
export interface StrategyProposal {
  readonly strategyId: string;
  readonly action: Action;
  /** Strategy-local conviction, 0..1. */
  readonly conviction: number;
  /** Suggested position size as a fraction of the per-trade budget (0..1). */
  readonly sizeFraction: number;
  readonly exitPlan: ExitPlan;
  readonly rationale: string;
}

/**
 * The plugin contract. Implement this interface, register it, and it
 * participates in every decision cycle. This is the heart of the
 * "strategy marketplace": a strategy is just an object with an `evaluate`.
 */
export interface Strategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Strategy authors declare which signal sources they care about. */
  readonly subscribes: readonly DiscoverySignal["source"][];
  /**
   * Return a proposal, or `null` to abstain on this token. Abstaining is the
   * common case — a momentum strategy should stay quiet on flat tokens.
   */
  evaluate(ctx: StrategyContext): StrategyProposal | null;
}
