# Writing strategies

A strategy is the simplest extension point in Open Alpha: an object implementing the `Strategy` interface from `@openalpha/types`.

## The contract

```ts
interface Strategy {
  id: string;
  name: string;
  description: string;
  /** Which discovery sources this strategy reacts to. */
  subscribes: DiscoverySource[];
  /** Return a proposal, or null to abstain (the common case). */
  evaluate(ctx: StrategyContext): StrategyProposal | null;
}

interface StrategyContext {
  discovery: DiscoverySignal;   // why the token surfaced
  market: MarketSnapshot;       // price, liquidity, volume/change windows, holders
  risk: RiskReport;             // 0-100 score, band, checks
}

interface StrategyProposal {
  strategyId: string;
  action: "BUY" | "SELL" | "WATCH" | "IGNORE";
  conviction: number;           // 0..1
  sizeFraction: number;         // 0..1 of the per-trade budget
  exitPlan: { takeProfitPct: number | null; stopLossPct: number | null; trailingStopPct: number | null };
  rationale: string;
}
```

## Principles

- **Be pure.** Given the same `ctx`, return the same proposal. That's what makes you backtestable.
- **Abstain often.** Returning `null` is normal — most tokens aren't your setup.
- **Don't size the whole portfolio.** Propose a `sizeFraction` of the per-trade budget; the agent handles guardrails, balance, and concurrency.
- **You don't enforce exits.** Declare an `exitPlan`; the `PositionManager` enforces TP/SL/trailing on every tick.

## Register it

```ts
import { StrategyRegistry } from "@openalpha/strategy-engine";
import { momentumStrategy, meanReversionStrategy } from "@openalpha/strategy-engine";
import { myStrategy } from "./my-strategy.ts";

const registry = new StrategyRegistry()
  .register(momentumStrategy())
  .register(meanReversionStrategy())
  .register(myStrategy);
```

Pass the registry into `createAgent` (via your own wiring) or extend `defaultRegistry()`.

## Backtest it

```ts
import { backtest } from "@openalpha/simulation-engine";
import { loadConfig } from "@openalpha/core-agent";

const result = await backtest({
  config: { ...loadConfig(), dataDir: "./data/my-test" },
  startMs: 1_750_000_000_000,
  stepMinutes: 5,
  steps: 288,
});
console.log(result.report); // win rate, expectancy, profit factor, drawdown…
```

Change `OPENALPHA_SEED` to test against a different synthetic market. Same seed ⇒ identical result.

## Reference strategies

- **`momentumStrategy`** — buys strong, well-funded 1h momentum; trailing-stop exit.
- **`meanReversionStrategy`** — fades sharp dips in tokens whose 6h trend is intact.

Read their source in `packages/strategy-engine/src/strategies/` — they're ~40 lines each.
