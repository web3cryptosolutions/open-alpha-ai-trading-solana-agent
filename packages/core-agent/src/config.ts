import type { Guardrails } from "@openalpha/types";

export type RuntimeMode = "mock" | "live-read" | "live";
export type EngineKind = "rules" | "claude";

/** Fully-resolved agent configuration. */
export interface AgentConfig {
  mode: RuntimeMode;
  engine: EngineKind;
  anthropicApiKey?: string;
  anthropicModel: string;
  startingSol: number;
  dataDir: string;
  /** Max discovery signals to evaluate per cycle (cost/throughput control). */
  maxSignalsPerCycle: number;
  guardrails: Guardrails;
  seed: string;
}

const num = (v: string | undefined, d: number): number => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Resolve config from a plain env bag (defaults to process.env). Everything
 * has a safe default so `runAgent()` works with an empty environment in mock
 * mode — zero keys, zero funds.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  const mode = (env.OPENALPHA_MODE as RuntimeMode) || "mock";
  const engine = (env.DECISION_ENGINE as EngineKind) || "rules";
  return {
    mode,
    engine,
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: env.ANTHROPIC_MODEL || "claude-opus-4-8",
    startingSol: num(env.OPENALPHA_STARTING_SOL, 10),
    dataDir: env.OPENALPHA_DATA_DIR || "./data",
    maxSignalsPerCycle: num(env.OPENALPHA_MAX_SIGNALS, 8),
    seed: env.OPENALPHA_SEED || "open-alpha",
    guardrails: {
      maxPositionSol: num(env.MAX_POSITION_SOL, 0.5),
      maxOpenPositions: num(env.MAX_OPEN_POSITIONS, 5),
      minRiskScoreToTrade: num(env.MIN_RISK_SCORE_TO_TRADE, 60),
      dailyLossLimitSol: num(env.DAILY_LOSS_LIMIT_SOL, 2),
    },
  };
}
