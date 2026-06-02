import type { Address, Mint, Timestamp } from "./token.ts";

export type TradeSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type ExecutionMode = "paper" | "live";

/** A request to execute a swap. Position sizing is resolved before this point. */
export interface OrderRequest {
  readonly mint: Mint;
  readonly side: TradeSide;
  readonly type: OrderType;
  /** SOL to spend. Required for buys; ignored for sells. */
  readonly amountSol?: number;
  /** Tokens to sell. Required for sells; ignored for buys. */
  readonly amountTokens?: number;
  /** For limit orders, the target price in SOL. */
  readonly limitPriceSol?: number;
  /** Max acceptable slippage as a fraction (0.01 = 1%). */
  readonly maxSlippage: number;
}

/** The result of an executor attempting an order. */
export interface ExecutionResult {
  readonly ok: boolean;
  readonly mode: ExecutionMode;
  readonly mint: Mint;
  readonly side: TradeSide;
  readonly filledSol: number;
  readonly filledTokens: number;
  readonly priceSol: number;
  /** Realized slippage vs the quote, as a fraction. */
  readonly slippage: number;
  /** On-chain signature for live trades; synthetic id for paper trades. */
  readonly signature: string;
  readonly error?: string;
  readonly executedAt: Timestamp;
}

/** Exit conditions attached to an open position. */
export interface ExitPlan {
  readonly takeProfitPct: number | null;
  readonly stopLossPct: number | null;
  /** Trailing stop as a fraction below the high-water mark. */
  readonly trailingStopPct: number | null;
}

export type PositionStatus = "open" | "closed";

/** A live or simulated position the agent holds. */
export interface Position {
  readonly id: string;
  readonly mint: Mint;
  readonly status: PositionStatus;
  readonly mode: ExecutionMode;
  readonly entrySol: number;
  readonly entryPriceSol: number;
  readonly tokens: number;
  readonly exitPlan: ExitPlan;
  /** Highest price seen since entry, for trailing-stop logic. */
  readonly highWaterPriceSol: number;
  readonly openedAt: Timestamp;
  readonly closedAt: Timestamp | null;
  readonly exitPriceSol: number | null;
  /** Realized PnL in SOL once closed. */
  readonly realizedPnlSol: number | null;
  /** Why the position was opened (links back to the decision). */
  readonly entryDecisionId: string;
  readonly exitReason: ExitReason | null;
}

export type ExitReason =
  | "take-profit"
  | "stop-loss"
  | "trailing-stop"
  | "agent-sell"
  | "manual"
  | "timeout";

/** Wallet snapshot for portfolio views. */
export interface WalletState {
  readonly address: Address | null;
  readonly mode: ExecutionMode;
  readonly solBalance: number;
  readonly positions: readonly Position[];
}
