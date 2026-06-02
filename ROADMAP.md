# Roadmap

Open Alpha shipped as a **complete, runnable vertical slice**: the full decision loop works end-to-end in mock mode with paper execution. The roadmap is about making each swappable interface real.

## ✅ v0.1 — Foundation (shipped)

- Monorepo, strict TypeScript, acyclic package graph
- Deterministic mock market + discovery
- 12-check risk engine with critical caps
- Strategy plugin system + momentum & mean-reversion references
- Rules **and** Claude decision engines behind one interface
- Size-aware paper executor + position manager (TP/SL/trailing)
- Local-first memory with similarity recall + pattern learning
- Deterministic backtester
- Dashboard, API, Telegram bot, Discord command layer

## 🔜 v0.2 — Real data

- [ ] **Helius** adapter (`DexProvider`) — new pools, holders, transactions
- [ ] **Birdeye / Jupiter price** adapter for live snapshots
- [ ] **RugCheck-style** security adapter feeding `TokenSecurity`
- [ ] Websocket/Geyser firehose for sub-second discovery
- [ ] Replay adapter: record live data → deterministic backtests on real history

## 🔭 v0.3 — Live execution

- [ ] Implement `JupiterExecutor` (v6 quote + swap, priority fees, retries)
- [ ] Keypair management & hardware-wallet signing
- [ ] Limit orders, take-profit/stop-loss as resting on-chain orders
- [ ] MEV-aware submission (Jito bundles)

## 🧠 v0.4 — Smarter brain

- [ ] Implement the **smart-money engine** (`wallet-tracker`) on Helius
- [ ] **Social intelligence** adapter (X / Telegram mention velocity + sentiment)
- [ ] Memory → embeddings recall option alongside the interpretable distance
- [ ] Multi-strategy portfolio allocation & correlation-aware sizing

## 🌐 v1.0 — Ecosystem

- [ ] **Strategy marketplace** — publish/install strategies as packages
- [ ] SQLite/Postgres memory backend
- [ ] Multi-agent orchestration (one agent per strategy/wallet)
- [ ] Hosted dashboard + alerting
- [ ] Plugin SDK + scaffolding CLI (`create-open-alpha-strategy`)

## Ideas welcome

Open an issue or discussion. The interfaces are the contract — if you can implement one, it slots straight in.
