# Getting started

## Prerequisites

- **Node ≥ 20** (Node 24 recommended)
- **pnpm 9** — `corepack enable` gives you the right version automatically

## Install

```bash
git clone https://github.com/your-org/open-alpha && cd open-alpha
corepack enable
pnpm install
```

## Run the loop (mock mode — no keys, no funds)

```bash
pnpm agent:backtest     # 24h deterministic backtest + scorecard
pnpm agent              # one live cycle against the mock market
LOOP=1 pnpm agent       # run continuously
pnpm dashboard          # http://localhost:3000
```

The agent writes its state to `./data/memory.json` (and backtests to `./data/backtest/`). The dashboard, API, and bots all read from there.

## Configure

```bash
cp .env.example .env
```

| Variable | Default | Notes |
|---|---|---|
| `OPENALPHA_MODE` | `mock` | `mock` \| `live-read` \| `live` |
| `DECISION_ENGINE` | `rules` | `rules` \| `claude` |
| `ANTHROPIC_API_KEY` | — | required for the Claude engine |
| `OPENALPHA_STARTING_SOL` | `10` | paper starting balance |
| `OPENALPHA_SEED` | `open-alpha` | mock-market seed (changes the universe) |
| `MIN_RISK_SCORE_TO_TRADE` | `60` | hard risk floor |
| `MAX_POSITION_SOL` | `0.5` | per-position cap |
| `MAX_OPEN_POSITIONS` | `5` | concurrency cap |
| `DAILY_LOSS_LIMIT_SOL` | `2` | halts new entries past this daily loss |

## Use the Claude decision engine

```bash
DECISION_ENGINE=claude ANTHROPIC_API_KEY=sk-ant-... pnpm agent
```

The model is forced to return a structured `Decision` via tool use, so output is always validated. If the API call fails, the agent transparently falls back to the rules engine.

## Next steps

- [Write a strategy](strategies.md)
- [The data model](data-model.md)
- [HTTP API](api.md)
- [Going live](execution.md)
- [Deployment](deployment.md)
