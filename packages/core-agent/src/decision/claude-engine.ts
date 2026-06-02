import type { Action, Decision, DecisionContext, StrategyProposal } from "@openalpha/types";
import { clamp01, round, type DecisionEngine } from "./engine.ts";

export interface ClaudeEngineOptions {
  apiKey: string;
  model?: string;
  /** Fallback engine used if the API call fails, so the agent never stalls. */
  fallback?: DecisionEngine;
}

const SYSTEM_PROMPT = `You are the decision core of an autonomous Solana trading agent.
You receive a structured evidence bundle about ONE token: a discovery signal, a market snapshot, a risk report, recalled memories of similar past trades, and hard guardrails.

Your job: choose exactly one action — BUY, SELL, WATCH, or IGNORE — and justify it.

Principles:
- Safety first. If the risk score is below the guardrail floor, you must IGNORE.
- Be skeptical of fresh, thin, or concentrated tokens. A live mint or freeze authority is disqualifying.
- Weigh recalled memory: if similar setups lost money, demand more edge.
- Reward/risk must justify the action. Size conviction honestly; most tokens deserve IGNORE or WATCH.
- Confidence, expectedRisk are 0..1. expectedReward is a multiple (1.5 = +50%).
- Always explain WHY in plain language a trader would respect.

Call submit_decision with your verdict. Never trade just to be active.`;

const TOOL = {
  name: "submit_decision",
  description: "Submit the final trading decision for this token.",
  input_schema: {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["BUY", "SELL", "WATCH", "IGNORE"] },
      confidence: { type: "number", description: "0..1 confidence in the action" },
      expectedRisk: { type: "number", description: "0..1 expected downside" },
      expectedReward: { type: "number", description: "expected upside multiple, e.g. 1.5" },
      reasoning: { type: "string", description: "1-3 sentence plain-language rationale" },
      factors: { type: "array", items: { type: "string" }, description: "3-5 short bullet factors" },
    },
    required: ["action", "confidence", "expectedRisk", "expectedReward", "reasoning", "factors"],
  },
};

/**
 * LLM decision engine powered by Claude via the Anthropic SDK. The model is
 * forced to call `submit_decision`, so we always get a validated, structured
 * `Decision` back — never free-text we have to parse. The heavy, static system
 * prompt is cached for cost/latency. If anything fails, we degrade to the
 * provided rules fallback so the agent keeps running.
 */
export class ClaudeDecisionEngine implements DecisionEngine {
  readonly id: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallback: DecisionEngine | undefined;
  private client: unknown;

  constructor(opts: ClaudeEngineOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "claude-opus-4-8";
    this.fallback = opts.fallback;
    this.id = `claude:${this.model}`;
  }

  async decide(ctx: DecisionContext, proposals: readonly StrategyProposal[]): Promise<Decision> {
    try {
      const client = await this.getClient();
      const msg = await (client as AnthropicLike).messages.create({
        model: this.model,
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "submit_decision" },
        messages: [{ role: "user", content: renderContext(ctx, proposals) }],
      });
      const block = msg.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("model did not call submit_decision");
      return this.fromToolInput(ctx, block.input as RawDecision);
    } catch (err) {
      if (this.fallback) return this.fallback.decide(ctx, proposals);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private fromToolInput(ctx: DecisionContext, raw: RawDecision): Decision {
    const expectedRisk = clamp01(Number(raw.expectedRisk));
    const expectedReward = Math.max(0, Number(raw.expectedReward) || 1);
    const rr = expectedRisk > 0 ? (expectedReward - 1) / expectedRisk : 0;
    return {
      mint: ctx.mint,
      action: (raw.action as Action) ?? "IGNORE",
      confidence: round(clamp01(Number(raw.confidence))),
      riskScore: ctx.risk.score,
      riskLevel: ctx.risk.level,
      expectedRisk: round(expectedRisk),
      expectedReward: round(expectedReward),
      rewardRiskRatio: round(rr, 2),
      reasoning: String(raw.reasoning ?? "").trim() || "No reasoning provided.",
      factors: Array.isArray(raw.factors) ? raw.factors.map(String).slice(0, 6) : [],
      engine: this.id,
      decidedAt: ctx.market.observedAt,
    };
  }

  private async getClient(): Promise<unknown> {
    if (this.client) return this.client;
    let mod: { default: new (o: { apiKey: string }) => unknown };
    try {
      mod = (await import("@anthropic-ai/sdk")) as typeof mod;
    } catch {
      throw new Error("@anthropic-ai/sdk is not installed. Run `pnpm add @anthropic-ai/sdk` to use the Claude engine.");
    }
    this.client = new mod.default({ apiKey: this.apiKey });
    return this.client;
  }
}

interface RawDecision {
  action: string;
  confidence: number;
  expectedRisk: number;
  expectedReward: number;
  reasoning: string;
  factors: string[];
}

/** Minimal structural type for the bits of the SDK we touch. */
interface AnthropicLike {
  messages: {
    create(args: unknown): Promise<{ content: Array<{ type: string; input?: unknown }> }>;
  };
}

/** Render the evidence bundle as a compact, model-friendly briefing. */
function renderContext(ctx: DecisionContext, proposals: readonly StrategyProposal[]): string {
  const m = ctx.market;
  const mem = ctx.memories
    .slice(0, 5)
    .map((x) => `- ${x.symbol}: ${x.decision.action} -> ${x.outcome ? `${x.outcome.result} ${(x.outcome.realizedPnlPct * 100).toFixed(0)}%` : "open"}`)
    .join("\n");
  return [
    `TOKEN: ${m.token.symbol} (${m.token.name})`,
    `DISCOVERY: ${ctx.discovery.source} — ${ctx.discovery.summary} (strength ${ctx.discovery.strength.toFixed(2)})`,
    ``,
    `MARKET:`,
    `  price: ${m.priceSol.toExponential(3)} SOL  ($${m.priceUsd.toExponential(3)})`,
    `  liquidity: $${Math.round(m.liquidityUsd).toLocaleString()}`,
    `  1h: ${(m.priceChange.h1 * 100).toFixed(1)}%  6h: ${(m.priceChange.h6 * 100).toFixed(1)}%  24h: ${(m.priceChange.h24 * 100).toFixed(1)}%`,
    `  vol 1h: $${Math.round(m.volume.h1).toLocaleString()}  holders: ${m.holderCount ?? "?"}`,
    ``,
    `RISK: ${ctx.risk.score}/100 (${ctx.risk.level})`,
    ...ctx.risk.topConcerns.map((c) => `  - ${c.label}: ${c.detail}`),
    ``,
    `STRATEGY PROPOSALS:`,
    ...(proposals.length
      ? proposals.map((p) => `  - ${p.strategyId}: ${p.action} @ ${(p.conviction * 100).toFixed(0)}% — ${p.rationale}`)
      : ["  (none)"]),
    ``,
    `RECALLED SIMILAR TRADES:`,
    mem || "  (none yet)",
    ``,
    `GUARDRAILS: minRiskScore=${ctx.guardrails.minRiskScoreToTrade}, maxPositionSol=${ctx.guardrails.maxPositionSol}, maxOpenPositions=${ctx.guardrails.maxOpenPositions}`,
    ``,
    `Decide now via submit_decision.`,
  ].join("\n");
}
