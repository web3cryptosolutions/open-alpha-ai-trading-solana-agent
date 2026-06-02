# Smart-money / wallet tracking

`@openalpha/wallet-tracker` ships the `WalletTracker` interface and a `StubWalletTracker` (emits nothing). This is the contract for the smart-money engine.

## What to implement

```ts
interface WalletTracker {
  id: string;
  profiles(): Promise<WalletProfile[]>;        // tracked wallets, best first
  discover(): Promise<DiscoverySignal[]>;       // signals from recent activity
  buyersOf(mint: Mint): Promise<WalletProfile[]>;
}
```

## Recommended recipe (Helius)

1. **Seed a watchlist** — wallets with a strong realized-PnL / win-rate history (compute from transaction history, or import a curated list).
2. **Stream their activity** — Helius enhanced transactions / webhooks for swaps by tracked wallets.
3. **Score** each wallet into a `WalletProfile` (`winRate`, `realizedPnlSol`, `earlinessMinutes`, `archetype`).
4. **Emit** `DiscoverySignal`s with `source: "smart-money"` when a high-quality wallet opens a position; attach the wallet(s) in `wallets`.

The discovery service already consumes these signals, and strategies can subscribe to `"smart-money"`. The decision engine treats smart-money signals as a stronger prior.
