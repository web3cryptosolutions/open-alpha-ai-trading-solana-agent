import type { Strategy, StrategyContext, StrategyProposal } from "@openalpha/types";

/**
 * Holds the active strategies and runs them against a context. This is the
 * "marketplace" runtime: register any object implementing `Strategy` and it
 * participates. Strategies that don't subscribe to a signal's source, or that
 * abstain, simply don't produce a proposal.
 */
export class StrategyRegistry {
  private readonly strategies = new Map<string, Strategy>();

  register(strategy: Strategy): this {
    if (this.strategies.has(strategy.id)) {
      throw new Error(`Strategy id "${strategy.id}" already registered`);
    }
    this.strategies.set(strategy.id, strategy);
    return this;
  }

  list(): readonly Strategy[] {
    return [...this.strategies.values()];
  }

  /** Run every subscribed strategy and collect non-null proposals. */
  evaluate(ctx: StrategyContext): StrategyProposal[] {
    const proposals: StrategyProposal[] = [];
    for (const s of this.strategies.values()) {
      if (!s.subscribes.includes(ctx.discovery.source)) continue;
      try {
        const p = s.evaluate(ctx);
        if (p) proposals.push(p);
      } catch {
        // A misbehaving strategy must never take down the cycle.
      }
    }
    return proposals;
  }
}
