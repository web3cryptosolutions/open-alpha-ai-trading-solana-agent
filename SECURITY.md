# Security & Safety

Open Alpha can, once you implement live execution, move real money. Read this before you do.

## Trading risk disclaimer

This software is provided for **education and research**. It is **not financial advice**. Automated trading of crypto assets — especially low-liquidity Solana tokens — carries a substantial risk of total loss. You are solely responsible for any trades you execute and for compliance with the laws of your jurisdiction. The authors accept no liability for losses.

## Safe by default

- The default mode is **`mock`**: a deterministic in-memory market and a **paper executor**. No keys, no signing, no funds.
- Live execution (`JupiterExecutor`) ships as a **stub that throws**. You must implement it and explicitly set `OPENALPHA_MODE=live` to trade for real.
- Guardrails wrap every decision and cannot be bypassed by a strategy:
  - `MAX_POSITION_SOL` — max SOL per position
  - `MAX_OPEN_POSITIONS` — max concurrent positions
  - `MIN_RISK_SCORE_TO_TRADE` — hard risk floor
  - `DAILY_LOSS_LIMIT_SOL` — halts new entries after a daily loss threshold

## Key & wallet handling

- **Never commit keys.** `.env`, `*.keypair.json`, and `wallet.json` are git-ignored. Double-check before pushing.
- Use a **dedicated hot wallet** funded only with what you can lose — never your main wallet.
- Prefer environment variables or a secrets manager over files. For meaningful size, use hardware-wallet signing (roadmap).
- Rotate any key that has ever touched a non-mock run before you trust it.

## Before going live — checklist

- [ ] You have read and understood `execution-engine` and `core-agent` source.
- [ ] You backtested and paper-traded your configuration extensively.
- [ ] Guardrails are set conservatively.
- [ ] You are using a throwaway hot wallet with limited funds.
- [ ] You understand slippage, MEV, and that mock results are **not** predictive of live results.

## Reporting a vulnerability

Found a security issue (key leakage, an unsafe default, a guardrail bypass)? **Do not open a public issue.** Email the maintainers (see repository profile) with details and a reproduction. We'll acknowledge within a few days.
