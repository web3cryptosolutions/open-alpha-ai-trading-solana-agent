# Contributing to Open Alpha

Thanks for being here. Open Alpha is built to be **forked and extended** — the best contributions add a new implementation behind an existing interface.

## Setup

```bash
corepack enable
pnpm install
pnpm agent:backtest      # sanity check: the loop runs
pnpm typecheck           # strict, must pass
```

- Node ≥ 20, pnpm 9 (via corepack).
- Strict TypeScript, no `any`, no unused vars. The repo typechecks clean — keep it that way.
- Library code never calls `Date.now()` / `Math.random()` directly — take an injected `now()` and a seeded RNG so everything stays deterministic and testable.
- Model unknowns as `null`, not `0`.

## Where to add things

| You want to… | Implement… | In… |
|---|---|---|
| Add a data source | `DexProvider` | `packages/token-discovery/src/adapters/` |
| Add a risk check | `RiskCheck` | `packages/risk-engine/src/checks.ts` |
| Add a strategy | `Strategy` | `packages/strategy-engine/src/strategies/` |
| Add an execution venue | `Executor` | `packages/execution-engine/src/` |
| Change the brain | `DecisionEngine` | `packages/core-agent/src/decision/` |

Each interface is small and documented at its definition. Match the surrounding code's style.

## Pull requests

1. Branch from `main`.
2. Keep PRs focused — one interface implementation or one feature.
3. `pnpm typecheck` must pass. Add a runnable example or a note on how you verified.
4. Update the relevant doc in `docs/` if you changed a contract.
5. Describe *why*, not just *what*.

## Good first issues

Great entry points — each is self-contained and behind a clean interface:

- **`volume` strategy** — buy on volume acceleration with a holder-growth confirmation.
- **`scalping` strategy** — tight TP/SL on very-short-term momentum.
- **New risk check** — "sniper concentration" (fraction of supply bought in block 0).
- **Birdeye price adapter** — implement `DexProvider.getSnapshot` against the Birdeye API.
- **CSV export** — add `GET /api/export.csv` to `apps/api` for closed trades.
- **Dashboard: Strategies tab** — list registered strategies with per-source win rates from `MemoryEngine.patterns()`.
- **Sparkline per position** — render a tiny price path in the positions table.

Comment on the issue (or open one) before starting something large.

## Code of conduct

Be kind, assume good faith, no financial shilling in issues/PRs. This is an engineering project.
