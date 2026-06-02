import type {
  AgentEvent,
  Decision,
  EventLevel,
  MarketFingerprint,
  MarketSnapshot,
  Position,
  RiskReport,
  StrategyProposal,
  TradeMemory,
} from "@openalpha/types";
import type { DiscoveryService } from "@openalpha/token-discovery";
import type { RiskEngine } from "@openalpha/risk-engine";
import type { StrategyRegistry } from "@openalpha/strategy-engine";
import type { Executor } from "@openalpha/execution-engine";
import type { JsonStore, MemoryEngine } from "@openalpha/memory-engine";
import type { DecisionEngine } from "./decision/engine.ts";
import type { AgentConfig } from "./config.ts";
import { PositionManager } from "./position-manager.ts";

export interface AgentDeps {
  config: AgentConfig;
  discovery: DiscoveryService;
  risk: RiskEngine;
  strategies: StrategyRegistry;
  decisionEngine: DecisionEngine;
  executor: Executor;
  store: JsonStore;
  memory: MemoryEngine;
  now: () => number;
}

export interface CycleSummary {
  readonly evaluated: number;
  readonly opened: number;
  readonly closed: number;
  readonly decisions: readonly Decision[];
}

/**
 * The autonomous loop. One `runCycle()` is: monitor open positions, discover
 * fresh opportunities, assess + decide on each, and act within guardrails —
 * narrating every step into the store so nothing is a black box. Call it on a
 * timer (live) or in a tight loop over a clock (backtest).
 */
export class Agent {
  private readonly d: AgentDeps;
  private readonly positions: PositionManager;
  private seq = 0;

  constructor(deps: AgentDeps) {
    this.d = deps;
    this.positions = new PositionManager(deps.executor);
  }

  async runCycle(): Promise<CycleSummary> {
    const { discovery, store, now } = this.d;
    this.emit("info", "cycle-start", `Cycle start — balance ${this.d.executor.balanceSol().toFixed(3)} SOL, ${store.openPositions().length} open.`);

    const closed = await this.monitorOpenPositions();

    const signals = (await discovery.discover()).slice(0, this.d.config.maxSignalsPerCycle);
    this.emit("debug", "discovered", `Discovered ${signals.length} candidate(s).`);

    const decisions: Decision[] = [];
    let opened = 0;

    for (const signal of signals) {
      const snap = await discovery.getSnapshot(signal.mint);
      const sec = await discovery.getSecurity(signal.mint);
      if (!snap || !sec) continue;

      const risk = this.d.risk.assess(sec, snap);
      this.emit("debug", "assessed", `${snap.token.symbol}: risk ${risk.score}/100 (${risk.level}).`, snap, risk);

      const proposals = this.d.strategies.evaluate({ discovery: signal, market: snap, risk });
      const fingerprint = buildFingerprint(signal, snap, risk, sec.tokenAgeMinutes);
      const memories = this.d.memory.recall(fingerprint, 5);

      const decision = await this.d.decisionEngine.decide(
        { mint: signal.mint, discovery: signal, market: snap, risk, memories, guardrails: this.d.config.guardrails },
        proposals,
      );
      decisions.push(decision);
      store.addDecision(decision);
      this.emit("info", "decided", `${snap.token.symbol}: ${decision.action} (${(decision.confidence * 100).toFixed(0)}% conf) — ${decision.reasoning}`, snap, risk, decision.action);

      if (decision.action === "BUY") {
        const did = await this.tryOpen(decision, proposals, snap, fingerprint);
        if (did) opened++;
      } else if (decision.action === "SELL") {
        await this.closeIfHeld(signal.mint, snap.priceSol, "agent-sell");
      }
    }

    store.flush(now());
    return { evaluated: signals.length, opened, closed, decisions };
  }

  // ── position lifecycle ────────────────────────────────────────────────────
  private async monitorOpenPositions(): Promise<number> {
    let closedCount = 0;
    for (const pos of this.d.store.openPositions()) {
      const snap = await this.d.discovery.getSnapshot(pos.mint);
      if (!snap) continue;
      const { position, closed } = await this.positions.tick(pos, snap.priceSol);
      this.d.store.upsertPosition(position);
      if (closed) {
        closedCount++;
        this.recordOutcome(position);
        const pnl = position.realizedPnlSol ?? 0;
        this.emit("trade", "closed", `Closed ${snap.token.symbol} via ${position.exitReason}: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} SOL.`, snap, undefined, "SELL");
      }
    }
    return closedCount;
  }

  private async tryOpen(
    decision: Decision,
    proposals: readonly StrategyProposal[],
    snap: MarketSnapshot,
    fingerprint: MarketFingerprint,
  ): Promise<boolean> {
    const g = this.d.config.guardrails;
    const open = this.d.store.openPositions();

    if (open.length >= g.maxOpenPositions) {
      this.emit("warn", "guardrail", `Skip ${snap.token.symbol}: at max ${g.maxOpenPositions} open positions.`, snap);
      return false;
    }
    if (open.some((p) => p.mint === decision.mint)) {
      this.emit("debug", "skipped", `Already holding ${snap.token.symbol}.`, snap);
      return false;
    }
    if (this.lossLimitBreached()) {
      this.emit("warn", "guardrail", `Skip ${snap.token.symbol}: daily loss limit reached.`, snap);
      return false;
    }

    const lead = [...proposals].filter((p) => p.action === "BUY").sort((a, b) => b.conviction - a.conviction)[0];
    const fraction = lead?.sizeFraction ?? decision.confidence;
    const budget = Math.min(g.maxPositionSol, this.d.executor.balanceSol());
    const sizeSol = Math.max(0, Math.min(budget, budget * fraction));
    if (sizeSol < 0.001) {
      this.emit("warn", "guardrail", `Skip ${snap.token.symbol}: position size too small / insufficient balance.`, snap);
      return false;
    }

    const exitPlan = lead?.exitPlan ?? { takeProfitPct: 0.4, stopLossPct: 0.2, trailingStopPct: 0.18 };
    const { position, error } = await this.positions.open(decision, sizeSol, exitPlan);
    if (!position) {
      this.emit("warn", "error", `Open failed for ${snap.token.symbol}: ${error ?? "unknown"}.`, snap);
      return false;
    }
    this.d.store.upsertPosition(position);
    this.recordEntryMemory(position, decision, snap, fingerprint);
    this.emit("trade", "opened", `Opened ${snap.token.symbol}: ${sizeSol.toFixed(3)} SOL @ ${position.entryPriceSol.toExponential(3)} (TP ${pct(exitPlan.takeProfitPct)}, SL ${pct(exitPlan.stopLossPct)}).`, snap, undefined, "BUY");
    return true;
  }

  private async closeIfHeld(mint: Position["mint"], price: number, reason: "agent-sell"): Promise<void> {
    const held = this.d.store.openPositions().find((p) => p.mint === mint);
    if (!held) return;
    // Force-close by treating current price as a trigger via a zeroed exit plan.
    const { position, closed } = await this.positions.tick(
      { ...held, exitPlan: { takeProfitPct: -1, stopLossPct: null, trailingStopPct: null } },
      price,
    );
    if (closed) {
      const finalPos: Position = { ...position, exitReason: reason };
      this.d.store.upsertPosition(finalPos);
      this.recordOutcome(finalPos);
    }
  }

  private lossLimitBreached(): boolean {
    const cutoff = this.d.now() - 24 * 60 * 60_000;
    const realizedToday = this.d.store
      .snapshot()
      .positions.filter((p) => p.status === "closed" && (p.closedAt ?? 0) >= cutoff)
      .reduce((s, p) => s + (p.realizedPnlSol ?? 0), 0);
    return realizedToday <= -this.d.config.guardrails.dailyLossLimitSol;
  }

  // ── memory ──────────────────────────────────────────────────────────────
  private recordEntryMemory(pos: Position, decision: Decision, snap: MarketSnapshot, fp: MarketFingerprint): void {
    const memory: TradeMemory = {
      id: pos.id,
      mint: pos.mint,
      symbol: snap.token.symbol,
      decision: {
        action: decision.action,
        confidence: decision.confidence,
        expectedReward: decision.expectedReward,
        expectedRisk: decision.expectedRisk,
        reasoning: decision.reasoning,
        engine: decision.engine,
      },
      entryConditions: fp,
      outcome: null,
      createdAt: pos.openedAt,
    };
    this.d.store.addTrade(memory);
  }

  private recordOutcome(pos: Position): void {
    const trade = this.d.store.snapshot().trades.find((t) => t.id === pos.id);
    if (!trade || pos.realizedPnlSol === null) return;
    const pnlPct = pos.entrySol > 0 ? pos.realizedPnlSol / pos.entrySol : 0;
    const holdMinutes = pos.closedAt && pos.openedAt ? (pos.closedAt - pos.openedAt) / 60_000 : 0;
    this.d.store.addTrade({
      ...trade,
      outcome: {
        realizedPnlSol: pos.realizedPnlSol,
        realizedPnlPct: pnlPct,
        holdMinutes,
        exitReason: pos.exitReason ?? "manual",
        result: pnlPct > 0.005 ? "win" : pnlPct < -0.005 ? "loss" : "breakeven",
      },
    });
  }

  // ── logging ───────────────────────────────────────────────────────────────
  private emit(level: EventLevel, kind: AgentEvent["kind"], message: string, snap?: MarketSnapshot, risk?: RiskReport, action?: AgentEvent["action"]): void {
    const event: AgentEvent = {
      id: `evt-${++this.seq}-${this.d.now()}`,
      level,
      kind,
      message,
      ...(snap ? { mint: snap.token.mint, symbol: snap.token.symbol } : {}),
      ...(action ? { action } : {}),
      ...(risk ? { data: { riskScore: risk.score, riskLevel: risk.level } } : {}),
      at: this.d.now(),
    };
    this.d.store.addEvent(event);
  }
}

function buildFingerprint(
  signal: { source: string },
  snap: MarketSnapshot,
  risk: RiskReport,
  tokenAgeMinutes: number | null,
): MarketFingerprint {
  return {
    riskScore: risk.score,
    liquidityUsd: snap.liquidityUsd,
    volumeH1: snap.volume.h1,
    priceChangeH1: snap.priceChange.h1,
    holderCount: snap.holderCount,
    discoverySource: signal.source,
    tokenAgeMinutes,
  };
}

const pct = (x: number | null): string => (x === null ? "—" : `${(x * 100).toFixed(0)}%`);
