import type { Action, Decision, DecisionContext, StrategyProposal } from "@openalpha/types";
import { clamp01, round, type DecisionEngine } from "./engine.ts";

/**
 * Deterministic decision engine. Reconciles strategy proposals against hard
 * risk guardrails and recalled memory, then emits a fully-explained decision.
 * No API key, fully testable, and the perfect baseline to A/B an LLM engine
 * against. Same input → same output, always.
 */
export class RulesDecisionEngine implements DecisionEngine {
  readonly id = "rules:v1";

  async decide(ctx: DecisionContext, proposals: readonly StrategyProposal[]): Promise<Decision> {
    const { risk, market, guardrails, memories } = ctx;
    const factors: string[] = [];

    // 1) Hard guardrail: risk floor. Disqualifies before anything else.
    if (risk.score < guardrails.minRiskScoreToTrade) {
      return this.decision(ctx, "IGNORE", 0.9, 0.9, 1, [
        `Risk ${risk.score}/100 below floor of ${guardrails.minRiskScoreToTrade}.`,
        ...risk.topConcerns.slice(0, 2).map((c) => c.detail),
      ], `Skipped: risk score ${risk.score} (${risk.level}) is below the configured floor. Top concern: ${risk.topConcerns[0]?.detail ?? "n/a"}`);
    }

    // 2) Aggregate proposals by action, weighting by conviction.
    const byAction = new Map<Action, number>();
    for (const p of proposals) byAction.set(p.action, (byAction.get(p.action) ?? 0) + p.conviction);
    const buy = byAction.get("BUY") ?? 0;
    const sell = byAction.get("SELL") ?? 0;
    const watch = byAction.get("WATCH") ?? 0;

    if (proposals.length === 0) {
      return this.decision(ctx, "IGNORE", 0.5, 1 - risk.score / 100, 1, ["No strategy produced a proposal for this setup."], "No subscribed strategy found an edge here.");
    }

    // 3) Pick dominant action.
    let action: Action = "WATCH";
    if (buy > sell && buy >= 0.4) action = "BUY";
    else if (sell > buy && sell >= 0.4) action = "SELL";
    else if (watch > 0) action = "WATCH";
    else action = "IGNORE";

    // 4) Memory adjustment: temper confidence with how similar past setups went.
    const memWinRate = winRateOf(memories);
    if (memories.length >= 3) {
      factors.push(`Recalled ${memories.length} similar setups: ${(memWinRate * 100).toFixed(0)}% won.`);
    }

    // 5) Build confidence / risk / reward.
    const topConviction = Math.max(buy, sell, watch);
    const riskFactor = risk.score / 100;
    const memFactor = memories.length >= 3 ? 0.6 + memWinRate * 0.8 : 1; // neutral if no data
    const confidence = clamp01(topConviction * 0.6 + riskFactor * 0.4) * clamp01(memFactor);

    const dominant = proposals
      .filter((p) => p.action === action)
      .sort((a, b) => b.conviction - a.conviction)[0];
    const tp = dominant?.exitPlan.takeProfitPct ?? 0.3;
    const sl = dominant?.exitPlan.stopLossPct ?? 0.2;

    const expectedRisk = clamp01((1 - riskFactor) * 0.6 + sl * 0.4);
    const expectedReward = action === "BUY" ? 1 + tp * confidence : 1;

    factors.push(
      `Risk ${risk.score}/100 (${risk.level}).`,
      `Momentum 1h ${(market.priceChange.h1 * 100).toFixed(0)}%, vol $${Math.round(market.volume.h1 / 1000)}k.`,
      dominant ? `Lead strategy: ${dominant.strategyId} (${(dominant.conviction * 100).toFixed(0)}% conviction).` : "No lead strategy.",
    );

    const reasoning = buildReasoning(action, ctx, dominant?.rationale, memWinRate, memories.length);
    return this.decision(ctx, action, confidence, expectedRisk, expectedReward, factors, reasoning);
  }

  private decision(
    ctx: DecisionContext,
    action: Action,
    confidence: number,
    expectedRisk: number,
    expectedReward: number,
    factors: string[],
    reasoning: string,
  ): Decision {
    const rr = expectedRisk > 0 ? (expectedReward - 1) / expectedRisk : 0;
    return {
      mint: ctx.mint,
      action,
      confidence: round(confidence),
      riskScore: ctx.risk.score,
      riskLevel: ctx.risk.level,
      expectedRisk: round(expectedRisk),
      expectedReward: round(expectedReward),
      rewardRiskRatio: round(rr, 2),
      reasoning,
      factors,
      engine: this.id,
      decidedAt: ctx.market.observedAt,
    };
  }
}

function winRateOf(memories: DecisionContext["memories"]): number {
  const withOutcome = memories.filter((m) => m.outcome);
  if (withOutcome.length === 0) return 0.5;
  return withOutcome.filter((m) => m.outcome!.result === "win").length / withOutcome.length;
}

function buildReasoning(
  action: Action,
  ctx: DecisionContext,
  rationale: string | undefined,
  memWinRate: number,
  memCount: number,
): string {
  const parts = [
    `${action} on ${ctx.market.token.symbol}.`,
    rationale ?? "",
    `Risk assessed at ${ctx.risk.score}/100 (${ctx.risk.level}).`,
  ];
  if (memCount >= 3) parts.push(`History: ${memCount} comparable setups won ${(memWinRate * 100).toFixed(0)}% of the time.`);
  if (ctx.risk.topConcerns.length) parts.push(`Watch: ${ctx.risk.topConcerns[0]!.detail}`);
  return parts.filter(Boolean).join(" ");
}
