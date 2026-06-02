/**
 * Core market-data primitives.
 *
 * These are the raw observations the agent reasons over. Every field is
 * either directly observed from a data provider or `null` when unknown —
 * we never silently default unknowns to zero, because "we don't know the
 * liquidity" and "the liquidity is zero" are very different risk signals.
 */

/** A supported decentralized exchange / launchpad. */
export type Dex = "jupiter" | "raydium" | "meteora" | "pumpfun" | "orca";

/** SPL token mint address (base58). */
export type Mint = string & { readonly __brand: "Mint" };

/** Wallet address (base58). */
export type Address = string & { readonly __brand: "Address" };

/** Unix epoch milliseconds. */
export type Timestamp = number;

export interface TokenMeta {
  readonly mint: Mint;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  /** When the mint was first created, if known. */
  readonly createdAt: Timestamp | null;
  readonly logoUri: string | null;
}

/** A liquidity pool for a token on a given DEX. */
export interface Pool {
  readonly dex: Dex;
  readonly address: Address;
  readonly baseMint: Mint;
  readonly quoteMint: Mint;
  /** Total value locked, in USD. */
  readonly liquidityUsd: number;
  /** When liquidity was first added to this pool, if known. */
  readonly createdAt: Timestamp | null;
}

/**
 * A point-in-time snapshot of everything we observe about a token.
 * This is the unit of work that flows through the pipeline.
 */
export interface MarketSnapshot {
  readonly token: TokenMeta;
  readonly pool: Pool;
  readonly priceUsd: number;
  readonly priceSol: number;
  readonly marketCapUsd: number | null;
  readonly fdvUsd: number | null;
  readonly liquidityUsd: number;
  /** Rolling windows of volume in USD. */
  readonly volume: VolumeWindows;
  /** Rolling windows of price change as a fraction (0.1 = +10%). */
  readonly priceChange: ChangeWindows;
  readonly holderCount: number | null;
  /** Holder growth (new holders) over the windows. */
  readonly holderChange: ChangeWindows | null;
  readonly txns: TxnWindows;
  readonly observedAt: Timestamp;
}

export interface VolumeWindows {
  readonly m5: number;
  readonly h1: number;
  readonly h6: number;
  readonly h24: number;
}

export interface ChangeWindows {
  readonly m5: number;
  readonly h1: number;
  readonly h6: number;
  readonly h24: number;
}

export interface TxnWindows {
  readonly m5: { buys: number; sells: number };
  readonly h1: { buys: number; sells: number };
  readonly h24: { buys: number; sells: number };
}
