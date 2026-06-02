import type { DiscoverySignal, MarketSnapshot, Mint, TokenSecurity } from "@openalpha/types";

/**
 * The provider abstraction. A `DexProvider` knows how to (a) surface fresh
 * discovery signals and (b) resolve a full market snapshot for a mint.
 *
 * The whole point of this interface is that the rest of the system never
 * knows whether it's talking to a deterministic mock, a Birdeye adapter, or
 * a websocket firehose. Swap the adapter, keep the brain.
 */
export interface DexProvider {
  readonly id: string;
  /** Pull the latest batch of discovery signals from this source. */
  discover(): Promise<DiscoverySignal[]>;
  /** Resolve a full, current market snapshot for a token. */
  getSnapshot(mint: Mint): Promise<MarketSnapshot | null>;
  /** Resolve on-chain & holder-graph security facts for a token. */
  getSecurity(mint: Mint): Promise<TokenSecurity | null>;
}

/** Construction options shared by adapters. */
export interface ProviderOptions {
  /** Wall-clock used everywhere so adapters are testable / replayable. */
  now: () => number;
}
