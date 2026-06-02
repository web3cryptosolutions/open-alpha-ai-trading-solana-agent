import type { ExecutionMode, ExecutionResult, Mint, OrderRequest } from "@openalpha/types";

/** A live price+depth quote, the minimum an executor needs to fill an order. */
export interface Quote {
  readonly priceSol: number;
  readonly liquidityUsd: number;
}

/** Resolves a current quote for a mint. Wired to a `DexProvider` in practice. */
export type QuoteSource = (mint: Mint) => Promise<Quote | null>;

/**
 * The execution boundary. The agent never knows whether an order becomes a
 * real Jupiter swap or a simulated paper fill — it just calls `execute`. This
 * is what makes "paper today, live tomorrow" a config flip, not a rewrite.
 */
export interface Executor {
  readonly mode: ExecutionMode;
  /** Current free SOL balance available to spend. */
  balanceSol(): number;
  execute(order: OrderRequest): Promise<ExecutionResult>;
}
