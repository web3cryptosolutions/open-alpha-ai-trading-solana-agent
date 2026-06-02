# HTTP API specification

`@openalpha/api` is a zero-dependency Node HTTP server exposing the agent's state as JSON for the dashboard, bots, and external tooling.

```bash
pnpm api          # → http://localhost:4318
# or: PORT=8080 OPENALPHA_DATA_DIR=./data pnpm api
```

It reads the same local store the agent writes; it does **not** mutate state.

## Endpoints

### `GET /health`
```json
{ "ok": true }
```

### `GET /api/state`
Full projected view.
```jsonc
{
  "dataDir": "/abs/path/data/backtest",
  "startingSol": 10,
  "balanceSol": 8.678,
  "performance": { /* PerformanceReport, see below */ },
  "open": [ /* Position[] */ ],
  "closedRecent": [ /* up to 10 most-recent closed Position[] */ ],
  "updatedAt": 1750000000000
}
```

### `GET /api/performance`
The scorecard only (`PerformanceReport`):
```jsonc
{
  "startingSol": 10, "realizedPnlSol": -1.322, "realizedPnlPct": -13.22,
  "closedTrades": 42, "openTrades": 3, "wins": 8, "losses": 34,
  "winRate": 0.19, "avgWinSol": 0.1379, "avgLossSol": 0.0713,
  "expectancySol": -0.0315, "profitFactor": 0.45,
  "bestTradeSol": 0.2297, "worstTradeSol": -0.1094,
  "maxDrawdownPct": 17.14, "equityCurve": [ { "at": 0, "equitySol": 10 }, … ]
}
```

### `GET /api/positions`
```json
{ "open": [ /* Position[] */ ], "closedRecent": [ /* Position[] */ ] }
```

### `GET /api/events?limit=50`
Most-recent agent log entries (newest first), each an `AgentEvent`.

## Conventions

- All responses are `application/json` with `access-control-allow-origin: *`.
- `4xx`/`5xx` return `{ "error": "<message>" }`.
- SOL amounts are numbers in SOL (not lamports). Timestamps are epoch milliseconds.
- The Next.js dashboard also exposes the same data at its own `GET /api/state` route handler.

## Types

All response shapes are exported from `@openalpha/types` (`Position`, `AgentEvent`, `Decision`) and `@openalpha/analytics` (`PerformanceReport`). Import them for a fully-typed client.
