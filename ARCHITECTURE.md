# Architecture

Open Alpha is a monorepo of small, single-responsibility packages connected by typed contracts. The guiding principle: **the brain should never know what backend it's talking to.** Swap the data provider, the decision engine, or the executor, and nothing else changes.

## Dependency graph

`@openalpha/types` is the root of the graph and depends on nothing. Everything else depends on it and, at most, sideways on a few siblings. The graph is **acyclic** — enforced by keeping all shared shapes in `types`.

```
                         ┌───────────────┐
                         │     types     │   (contracts only, no runtime)
                         └──────┬────────┘
        ┌───────────────┬───────┼────────────┬─────────────────┐
        ▼               ▼       ▼            ▼                 ▼
 token-discovery  risk-engine  strategy-  execution-       memory-engine
        │               │      engine     engine               │
        └───────────────┴───────┬─────────┴──────────┬─────────┘
                                 ▼                    ▼
                            core-agent ◀──────── analytics
                                 ▲
                 ┌───────────────┼──────────────┐
                 ▼               ▼               ▼
            simulation       apps/api       (your app)
                              apps/dashboard, telegram, discord
```

## The contracts (`@openalpha/types`)

Five artifacts matter most:

- **`MarketSnapshot`** — a point-in-time observation of a token (price, liquidity, volume/price-change windows, holders, txns). Unknowns are `null`, never `0`.
- **`TokenSecurity`** — on-chain & holder-graph facts (authorities, LP lock, concentration, clustering, rug history, ages). The raw material for risk.
- **`RiskReport`** — a 0–100 score, a `safe`/`caution`/`danger` band, and the full list of explainable checks.
- **`Decision`** — the central artifact: `action` (BUY/SELL/WATCH/IGNORE) + confidence + risk + reward + reasoning + factors. The contract between thinking and acting.
- **`Strategy`** — the plugin contract: `evaluate(ctx) → StrategyProposal | null`.

## The engines

| Package | Responsibility | Key extension point |
|---|---|---|
| `token-discovery` | Surface candidates + resolve snapshots/security | `DexProvider` |
| `risk-engine` | Compose checks into a score | `RiskCheck` |
| `strategy-engine` | Run registered strategies | `Strategy` |
| `execution-engine` | Fill orders | `Executor` |
| `simulation-engine` | Drive the agent over a virtual clock | — |
| `memory-engine` | Persist, recall, learn | `JsonStore` (swap for SQL) |
| `analytics` | Score performance | — |
| `core-agent` | Orchestrate the cycle | `DecisionEngine` |

## The decision cycle

`Agent.runCycle()` is the heartbeat:

1. **Monitor** — re-evaluate open positions against the current price; exit on TP/SL/trailing-stop.
2. **Discover** — fan out across providers, dedupe by mint, take the top N.
3. For each candidate: **snapshot → security → risk → strategy proposals → recall memory → decide**.
4. **Act** within guardrails: size the position, open it, record an entry memory.
5. **Persist** — flush the store; every step emitted an `AgentEvent` for the UI.

The same method runs live (wall clock) and in backtests (injected clock) — that's what makes results reproducible.

## Design decisions worth knowing

- **Injected clock everywhere.** No library code calls `Date.now()` directly; the agent and providers take a `now()` function. Determinism is a feature, not an accident.
- **`null` over `0` for unknowns.** "We couldn't determine LP lock" and "LP is not locked" are different risk signals and are modeled differently.
- **Critical caps in risk scoring.** A weighted average alone would let a great-looking token with a live mint authority score "safe". Critical failures cap the score instead.
- **Strategies propose, the agent decides.** Strategies are pure and portfolio-blind, which keeps them backtestable. Reconciliation, sizing, and guardrails live in the agent.
- **Graceful degradation.** A misbehaving strategy can't crash a cycle; the Claude engine falls back to the rules engine on any API failure.
- **Local-first.** State is a single atomic-write JSON file. Easy to inspect, diff, and back up; swap `JsonStore` for SQLite/Postgres behind the same shape when you scale.

See [`docs/data-model.md`](docs/data-model.md) for the persisted schema and [`docs/api.md`](docs/api.md) for the HTTP surface.
