import type { Address, Mint, Timestamp } from "./token.ts";

/**
 * On-chain & holder-graph security facts about a token. This is the raw
 * material the risk engine turns into a score. It is produced by providers
 * (RugCheck-style services, Helius holder queries, on-chain reads) and, like
 * `MarketSnapshot`, uses `null` for genuinely-unknown values rather than
 * pretending zero.
 */
export interface TokenSecurity {
  readonly mint: Mint;

  /** Mint authority address, or `null` if revoked (good). */
  readonly mintAuthority: Address | null;
  /** Freeze authority address, or `null` if revoked (good). */
  readonly freezeAuthority: Address | null;

  /** Is LP locked or burned? `null` = couldn't determine. */
  readonly lpLocked: boolean | null;
  /** Fraction of LP held by the single largest LP holder, 0..1. */
  readonly lpConcentration: number | null;

  /** Fraction of supply held by the top 10 holders, 0..1. */
  readonly top10HolderPct: number | null;
  /** Fraction of supply held by the dev/deployer wallet, 0..1. */
  readonly devHoldingPct: number | null;

  /** Count of wallets that bought in the same bundle/block as the deployer. */
  readonly bundledWallets: number | null;
  /** Number of distinct funded-from-same-source clusters among top holders. */
  readonly walletClusters: number | null;

  /** Has the deployer been linked to a prior rug? `null` = unknown. */
  readonly deployerRugCount: number | null;

  /** Age of the mint in minutes. */
  readonly tokenAgeMinutes: number | null;
  /** Age of the primary pool's liquidity in minutes. */
  readonly liquidityAgeMinutes: number | null;

  readonly fetchedAt: Timestamp;
}
