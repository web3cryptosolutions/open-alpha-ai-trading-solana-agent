<div align="center">

# ◎ Open Alpha

### The autonomous trading operating system for Solana.

**Discovers opportunities. Scores risk. Forms a thesis. Simulates. Executes. Learns. And explains every single decision.**

[![License: MIT](https://img.shields.io/badge/License-MIT-2ecf8f.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-5b8cff.svg)](tsconfig.base.json)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-f5b54a.svg)](CONTRIBUTING.md)
[![Built for Solana](https://img.shields.io/badge/Solana-mainnet--ready-9945FF.svg)](#)

[Quickstart](#-quickstart) · [Architecture](#-architecture) · [How it thinks](#-how-the-agent-thinks) · [Strategies](#-write-a-strategy-in-30-lines) · [Roadmap](ROADMAP.md) · [Contribute](CONTRIBUTING.md)

</div>

---

> **Not a bot. An operating system for trading agents.**
>
> Most trading bots are a black box wrapped around a webhook. Open Alpha is the opposite: a modular, fully-typed framework where every engine — discovery, risk, strategy, decision, execution, memory — is swappable, testable, and **forced to explain itself**. Run the whole thing in **mock mode with zero keys and zero funds**, then flip one config value to go live.

```
◎ Open Alpha — Autonomous Trading OS
  mode=mock  engine=rules:v1  starting=10 SOL

  ● Opened INU67: 0.470 SOL @ 2.914e-5 (TP 60%, SL 20%)
  · INU67: BUY (90% conf) — Strong momentum: 1h 60%, vol $275k, risk 91/100.
  · APE73: IGNORE (90% conf) — Skipped: risk 25 (danger). Mint authority is LIVE.
  · RUG82: IGNORE — No subscribed strategy found an edge here.

  balance 9.054 SOL   open 2   closed 0
```

## ✨ Why people star this

- 🧠 **Explainable by construction.** Every decision carries a confidence, a risk score, an expected reward/risk, plain-language reasoning, and the factors behind it. No black boxes.
- 🛡️ **A real risk engine.** 12 composable on-chain checks (mint/freeze authority, LP lock & concentration, holder concentration, dev holdings, bundled wallets, clustering, rug history, token & liquidity age) → a single 0–100 score with critical caps. A token with a live mint authority can *never* read as "safe".
- 🔌 **Everything is an interface.** Data providers, the decision engine (rules **or** Claude), the executor (paper **or** Jupiter), strategies, and memory are all swappable behind clean contracts.
- 🧪 **Backtest, forward-test, paper-trade** on a deterministic, seeded market — same seed, same equity curve, every time. Research before you risk.
- 📈 **A dashboard you'd actually keep open.** Dark-mode-first, Linear/Vercel-grade. Portfolio, equity curve, risk distribution, positions, live decision log.
- 🤖 **Telegram & Discord** control surfaces, **zero external dependencies** for the Telegram client.
- 🦺 **Safe by default.** Ships in mock mode. Live execution is a deliberately-gated stub you must implement and opt into. Guardrails (max position, max open, risk floor, daily loss limit) wrap every decision.
- 💎 **Production-grade monorepo.** pnpm + Turborepo, strict TypeScript, acyclic package graph, no `any`.

## 🚀 Quickstart

```bash
# 1. Clone & install (Node ≥ 20, pnpm via corepack)
git clone https://github.com/your-org/open-alpha && cd open-alpha
corepack enable && pnpm install

# 2. Run a 24h backtest on the deterministic mock market (no keys, no funds)
pnpm agent:backtest

# 3. Run the agent live against the mock market
pnpm agent           # one cycle    ·    LOOP=1 pnpm agent  for continuous

# 4. Open the dashboard
pnpm dashboard       # → http://localhost:3000
```

That's it. **No API keys. No wallet. No funds.** You're watching a full autonomous trading loop — discovery → risk → decision → execution → memory → learning — run end to end.

Want the LLM brain? `cp .env.example .env`, set `DECISION_ENGINE=claude` and `ANTHROPIC_API_KEY`, and the same loop now reasons with Claude.

## 🧠 How the agent thinks

Every cycle, for every candidate token, the agent runs this pipeline. Each stage is a package you can replace.

```
   token-discovery        risk-engine          strategy-engine        core-agent
 ┌────────────────┐   ┌────────────────┐   ┌─────────────────┐   ┌──────────────────┐
 │ new launches   │   │ 12 on-chain    │   │ momentum        │   │ DecisionEngine   │
 │ volume spikes  │──▶│ checks → 0-100 │──▶│ mean-reversion  │──▶│  rules │ claude  │
 │ smart money    │   │ safe/caution/  │   │ (your plugin)   │   │ + memory recall  │
 │ trending …     │   │ danger + caps  │   │ → proposals     │   │ + guardrails     │
 └────────────────┘   └────────────────┘   └─────────────────┘   └────────┬─────────┘
                                                                           │ Decision
                       memory-engine        execution-engine               ▼
                     ┌────────────────┐   ┌─────────────────┐   BUY · SELL · WATCH · IGNORE
                     │ recall similar │◀──│ paper │ jupiter  │◀──┐ confidence · risk · reward
                     │ learn patterns │   │ size-aware fills │   │ reasoning · factors
                     └────────────────┘   └─────────────────┘   └── position-manager (TP/SL/trail)
```

A real decision the rules engine produced, verbatim:

```jsonc
{
  "action": "BUY",
  "confidence": 0.9,
  "riskScore": 91,
  "riskLevel": "safe",
  "expectedReward": 1.54,      // +54% target
  "expectedRisk": 0.28,
  "rewardRiskRatio": 1.93,
  "reasoning": "BUY on INU67. Strong momentum: 1h 60%, vol $275k, risk 91/100. Watch: top LP holder controls 38% of LP.",
  "factors": ["Risk 91/100 (safe).", "Momentum 1h 60%, vol $275k.", "Lead strategy: momentum (78% conviction)."],
  "engine": "rules:v1"
}
```

## 🔌 Write a strategy in 30 lines

A strategy is just an object with an `evaluate`. Register it and it participates in every decision cycle — the core agent reconciles all proposals, applies guardrails, and decides.

```ts
import type { Strategy } from "@openalpha/types";

export const breakoutStrategy: Strategy = {
  id: "breakout",
  name: "Range Breakout",
  description: "Buys a clean break above the 6h range on rising volume.",
  subscribes: ["volume-spike", "trending"],
  evaluate({ market, risk }) {
    const brokeOut = market.priceChange.h1 > 0.2 && market.priceChange.h6 > 0.1;
    if (!brokeOut || risk.score < 60) return null;        // abstain
    return {
      strategyId: "breakout",
      action: "BUY",
      conviction: Math.min(1, market.priceChange.h1) * (risk.score / 100),
      sizeFraction: 0.6,
      exitPlan: { takeProfitPct: 0.5, stopLossPct: 0.2, trailingStopPct: 0.15 },
      rationale: `Broke 6h range: 1h +${(market.priceChange.h1 * 100).toFixed(0)}%`,
    };
  },
};
```

```ts
import { StrategyRegistry } from "@openalpha/strategy-engine";
const registry = new StrategyRegistry().register(breakoutStrategy);
```

See [`docs/strategies.md`](docs/strategies.md) for the full contract.

## 🧱 Architecture

A pnpm + Turborepo monorepo with a strictly acyclic package graph — `@openalpha/types` is the only thing everyone depends on.

```
apps/
  dashboard            Next.js 14, dark-mode-first control room
  api                  zero-dep JSON API over the agent's state
  telegram             zero-dep Telegram bot (Bot API + long polling)
  discord              Discord command layer (gateway-ready)
packages/
  types                the shared contract every package speaks
  token-discovery      DexProvider interface + deterministic mock + discovery service
  risk-engine          12 composable checks → 0-100 score with critical caps
  strategy-engine      plugin registry + momentum & mean-reversion references
  execution-engine     Executor interface + size-aware PaperExecutor + Jupiter stub
  simulation-engine    deterministic backtester / forward-tester
  memory-engine        local-first JSON store + similarity recall + pattern learning
  analytics            PnL, win rate, expectancy, profit factor, drawdown, equity curve
  core-agent           the orchestrator: rules + Claude decision engines, position manager
  wallet-tracker       smart-money engine (interface + stub)
  social-intelligence  social signal engine (interface + stub)
```

Full design notes in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 🛡️ The risk engine

Twelve independent, weighted checks compose into one score. Each returns a verdict, a severity, and a sentence a human can read.

| Check | Guards against |
|---|---|
| Mint / freeze authority | Infinite mint, wallet freezing |
| Liquidity amount & lock | Thin pools, pullable liquidity |
| LP & holder concentration | A single wallet nuking the price |
| Dev holdings | Dev dump overhang |
| Bundled wallets & clustering | Disguised single-entity launches |
| Deployer rug history | Serial ruggers |
| Token & liquidity age | The high-volatility rug window |

Any critical failure (live mint/freeze authority, unlocked LP, known rug history) **caps** the score — so the band is honest.

## 🦺 Safety & live trading

Open Alpha runs in **`mock` mode by default**: a deterministic in-memory market and a paper executor. No keys, no signing, no funds.

Going live is a deliberate, multi-step opt-in: you must implement the `JupiterExecutor` stub, set `OPENALPHA_MODE=live`, and provide a funded keypair. **Do not run live mode with funds you cannot afford to lose.** Read [`SECURITY.md`](SECURITY.md) first. This software is provided for education and research and is **not financial advice**.

## 🗺️ Roadmap

Real-data adapters (Helius/Birdeye), live Jupiter execution, the smart-money engine, multi-agent portfolios, and a strategy marketplace. See [`ROADMAP.md`](ROADMAP.md) and the [good first issues](CONTRIBUTING.md#good-first-issues).

## 🤝 Contributing

We want this to be the most forkable trading framework on Solana. New strategies, new data adapters, new risk checks — all welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md).

## 📜 License

MIT © Open Alpha contributors. Trade responsibly.
