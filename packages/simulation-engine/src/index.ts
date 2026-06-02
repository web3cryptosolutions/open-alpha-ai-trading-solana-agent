import { createAgent, type AgentConfig } from "@openalpha/core-agent";
import { performance, type PerformanceReport } from "@openalpha/analytics";

export interface BacktestOptions {
  config: AgentConfig;
  /** Virtual start time in epoch ms. */
  startMs: number;
  /** Minutes of simulated time between cycles. */
  stepMinutes?: number;
  /** Number of cycles to run. */
  steps?: number;
  /** Called after each cycle for progress reporting. */
  onStep?: (i: number, clock: number) => void;
}

export interface BacktestResult {
  readonly report: PerformanceReport;
  readonly cycles: number;
  readonly decisions: number;
  readonly finalBalanceSol: number;
}

/**
 * Replays the deterministic mock market over a virtual clock, running the
 * agent's full decision loop each step, then scores the outcome. Because the
 * clock is injected and the market is seeded, the same inputs reproduce the
 * exact same equity curve — the property real strategy research depends on.
 *
 * Forward-testing is the same loop with `stepMinutes` tied to wall time; paper
 * trading is forward-testing with `steps = Infinity`.
 */
export async function backtest(opts: BacktestOptions): Promise<BacktestResult> {
  const stepMs = (opts.stepMinutes ?? 5) * 60_000;
  const steps = opts.steps ?? 288; // 24h at 5-min steps
  let clock = opts.startMs;

  const { agent, deps } = createAgent({ config: opts.config, now: () => clock });
  // Always start a backtest from a clean slate so runs are reproducible and
  // never accumulate onto previously-persisted state.
  deps.store.reset(opts.config.startingSol);

  let decisions = 0;
  for (let i = 0; i < steps; i++) {
    clock = opts.startMs + i * stepMs;
    const summary = await agent.runCycle();
    decisions += summary.decisions.length;
    opts.onStep?.(i, clock);
  }

  const state = deps.store.snapshot();
  return {
    report: performance(opts.config.startingSol, state.positions),
    cycles: steps,
    decisions,
    finalBalanceSol: deps.executor.balanceSol(),
  };
}
