# Data model & storage schema

Open Alpha is **local-first**. All state lives in a single JSON file written atomically (temp file + rename) by `@openalpha/memory-engine`'s `JsonStore`. Default location: `./data/memory.json` (backtests use `./data/backtest/memory.json`).

The store is intentionally simple so it's easy to inspect, diff, and back up. When you outgrow it, implement the same `JsonStore` surface over SQLite/Postgres — nothing else changes.

## Entity relationships

```
Decision ──(entryDecisionId)──▶ Position ──(id == id)──▶ TradeMemory
   │                               │                          │
   │ riskScore/riskLevel           │ realizedPnlSol            │ outcome (win/loss)
   ▼                               ▼                          ▼
AgentEvent (activity log)     analytics.performance()    MemoryEngine.recall()/patterns()
```

## Persisted shape (`StoreState`)

```jsonc
{
  "version": 1,
  "meta": { "startingSol": 10, "updatedAt": 1750000000000 },
  "decisions": [ /* Decision[] */ ],
  "positions": [ /* Position[] */ ],
  "trades":    [ /* TradeMemory[] */ ],   // entry conditions + outcome, for learning
  "events":    [ /* AgentEvent[] */ ]      // capped ring buffer (last 5000)
}
```

## Tables (logical)

### `decisions` — every verdict, never trimmed
| Field | Type | Notes |
|---|---|---|
| `mint` | string | token mint (base58) |
| `action` | `BUY\|SELL\|WATCH\|IGNORE` | |
| `confidence` | number | 0..1 |
| `riskScore` / `riskLevel` | number / band | risk context at decision time |
| `expectedReward` / `expectedRisk` | number | reward is a multiple; risk is 0..1 |
| `rewardRiskRatio` | number | |
| `reasoning` / `factors` | string / string[] | the explanation |
| `engine` | string | `rules:v1` \| `claude:<model>` |
| `decidedAt` | epoch ms | |

### `positions` — lifecycle of each trade
| Field | Type | Notes |
|---|---|---|
| `id` | string | also the `TradeMemory` id |
| `mint` | string | |
| `status` | `open\|closed` | |
| `mode` | `paper\|live` | |
| `entrySol` / `entryPriceSol` / `tokens` | number | |
| `exitPlan` | object | TP / SL / trailing |
| `highWaterPriceSol` | number | for trailing stop |
| `realizedPnlSol` / `exitPriceSol` / `exitReason` | nullable | set on close |
| `openedAt` / `closedAt` | epoch ms | |
| `entryDecisionId` | string | links to the `Decision` |

### `trades` — learning memory
`TradeMemory` snapshots the decision, a comparable `MarketFingerprint` (riskScore, liquidity, volumeH1, priceChangeH1, holders, source, age), and the `TradeOutcome` (pnl, hold time, exit reason, win/loss). `MemoryEngine.recall(fingerprint)` returns the nearest past episodes by normalized distance; `patterns()` aggregates win-rates by discovery source.

### `events` — activity log
`AgentEvent { level, kind, message, mint?, symbol?, action?, data?, at }`. Powers the dashboard feed and bot replies. Capped at the last 5000 to bound file size — use `decisions`/`positions` for full history.

## Inspecting it

```bash
cat data/memory.json | jq '.positions[] | select(.status=="closed") | {mint, realizedPnlSol, exitReason}'
```
