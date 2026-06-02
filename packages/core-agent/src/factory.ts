import { DiscoveryService, MockDexProvider } from "@openalpha/token-discovery";
import { RiskEngine } from "@openalpha/risk-engine";
import { defaultRegistry } from "@openalpha/strategy-engine";
import { JupiterExecutor, PaperExecutor, type Executor } from "@openalpha/execution-engine";
import { JsonStore, MemoryEngine } from "@openalpha/memory-engine";
import { Agent, type AgentDeps } from "./agent.ts";
import { RulesDecisionEngine } from "./decision/rules-engine.ts";
import { ClaudeDecisionEngine } from "./decision/claude-engine.ts";
import type { DecisionEngine } from "./decision/engine.ts";
import type { AgentConfig } from "./config.ts";

export interface CreateAgentOptions {
  config: AgentConfig;
  /** Inject a clock for deterministic backtests. Defaults to wall-clock. */
  now?: () => number;
  /** Override the data provider (e.g. a real Birdeye adapter). */
  provider?: ConstructorParameters<typeof DiscoveryService>[0][number];
}

/**
 * Wires a fully-functional agent from config alone. In `mock` mode this needs
 * zero keys and zero funds: deterministic market + paper execution. Flip
 * `DECISION_ENGINE=claude` (with a key) to swap the brain, or `OPENALPHA_MODE`
 * to change the data/execution backends — the wiring is the only thing that
 * knows the difference.
 */
export function createAgent(opts: CreateAgentOptions): { agent: Agent; deps: AgentDeps } {
  const { config } = opts;
  const now = opts.now ?? (() => Date.now());

  const provider = opts.provider ?? new MockDexProvider({ now, seed: config.seed });
  const discovery = new DiscoveryService([provider]);

  const executor: Executor =
    config.mode === "live"
      ? new JupiterExecutor({
          rpcUrl: process.env.SOLANA_RPC_URL ?? "",
          keypairPath: process.env.SOLANA_KEYPAIR_PATH ?? "",
          jupiterApiUrl: process.env.JUPITER_API_URL ?? "",
        })
      : new PaperExecutor({
          startingSol: config.startingSol,
          now,
          quoteSource: async (mint) => {
            const snap = await discovery.getSnapshot(mint);
            return snap ? { priceSol: snap.priceSol, liquidityUsd: snap.liquidityUsd } : null;
          },
        });

  const store = new JsonStore(config.dataDir, config.startingSol);
  const memory = new MemoryEngine(store);

  const rules = new RulesDecisionEngine();
  const decisionEngine: DecisionEngine =
    config.engine === "claude" && config.anthropicApiKey
      ? new ClaudeDecisionEngine({ apiKey: config.anthropicApiKey, model: config.anthropicModel, fallback: rules })
      : rules;

  const deps: AgentDeps = {
    config,
    discovery,
    risk: new RiskEngine(),
    strategies: defaultRegistry(),
    decisionEngine,
    executor,
    store,
    memory,
    now,
  };
  return { agent: new Agent(deps), deps };
}
