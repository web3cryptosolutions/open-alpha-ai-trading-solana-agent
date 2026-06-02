# Execution: paper today, live tomorrow

Execution sits behind one interface so the agent never knows whether an order becomes a simulated fill or a real Jupiter swap.

```ts
interface Executor {
  mode: "paper" | "live";
  balanceSol(): number;
  execute(order: OrderRequest): Promise<ExecutionResult>;
}
```

## Paper execution (default)

`PaperExecutor` simulates fills against live quotes with a **size-aware slippage model**: the bigger your order relative to pool liquidity, the worse your fill — plus a base slippage and a fee. This is what makes paper results resemble live results instead of the fantasy fills most bots backtest against. It tracks a virtual SOL balance.

```ts
new PaperExecutor({
  startingSol: 10,
  now: () => Date.now(),
  quoteSource: async (mint) => {
    const snap = await discovery.getSnapshot(mint);
    return snap ? { priceSol: snap.priceSol, liquidityUsd: snap.liquidityUsd } : null;
  },
});
```

## Going live (advanced, opt-in)

`JupiterExecutor` ships as a **stub that throws** — by design, so cloning the repo can never trade real money by accident. To implement it:

1. **Quote** — `GET {JUPITER_API_URL}/quote` with input/output mints, amount, and `slippageBps`.
2. **Swap** — `POST {JUPITER_API_URL}/swap` with the quote + your public key to get a serialized transaction.
3. **Sign & send** — deserialize, sign with your keypair, send via the RPC, confirm. Add priority fees; consider Jito bundles for MEV protection.
4. Map the confirmed swap into an `ExecutionResult` (`filledSol`, `filledTokens`, `priceSol`, realized `slippage`, on-chain `signature`).

Then:

```bash
OPENALPHA_MODE=live \
SOLANA_RPC_URL=https://… \
SOLANA_KEYPAIR_PATH=/secure/hot-wallet.json \
JUPITER_API_URL=https://quote-api.jup.ag/v6 \
pnpm agent
```

## Before you trade real money

Read [`SECURITY.md`](../SECURITY.md). Use a throwaway hot wallet with only what you can lose. Mock and paper results are **not** predictive of live performance. This is not financial advice.
