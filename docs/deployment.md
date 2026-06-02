# Deployment

Open Alpha is a Node app + a Next.js dashboard. The agent, API, and bots run via `tsx` (no build step); the dashboard builds with Next.

## Local (no Docker)

```bash
pnpm install
LOOP=1 pnpm agent     # agent loop (writes ./data)
pnpm api              # JSON API on :4318
pnpm dashboard        # dashboard on :3000
pnpm telegram         # set TELEGRAM_BOT_TOKEN first
```

Run each in its own terminal, or use a process manager (pm2, systemd, foreman).

## Docker

```bash
# One-shot backtest
docker build -t open-alpha .
docker run --rm open-alpha pnpm agent:backtest

# Full stack (agent loop + API + dashboard) with shared ./data volume
docker compose up
# dashboard → http://localhost:3000 · api → http://localhost:4318
```

The `data/` directory is mounted as a shared volume so the agent writes and the API/dashboard read the same store.

## Environment

Set variables via `.env` (loaded by your shell/compose) or your platform's secrets manager. See [getting-started](getting-started.md#configure) for the full list. **Never bake keys into an image.**

## Production notes

- **Dashboard:** build for production (`pnpm --filter @openalpha/dashboard build && … start`) rather than `next dev`. The compose file uses dev mode for convenience.
- **Persistence:** the default `JsonStore` is single-writer. Run exactly one agent process per data directory. For multi-agent setups, give each its own `OPENALPHA_DATA_DIR`, or implement a SQL-backed store.
- **Live mode:** mount the keypair as a read-only secret, set `OPENALPHA_MODE=live`, and apply conservative guardrails. Read [`SECURITY.md`](../SECURITY.md).
- **One-click:** the dashboard deploys to Vercel as a standalone Next app (point its loader at a reachable data source or the API).
