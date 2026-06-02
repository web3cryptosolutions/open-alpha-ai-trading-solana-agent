import type { Address, DiscoverySignal, Mint, Timestamp } from "@openalpha/types";

/**
 * Smart-money profile for a tracked wallet. The wallet-tracker's job is to
 * keep these up to date from on-chain history and surface the best ones as
 * discovery signals when they move.
 */
export interface WalletProfile {
  readonly address: Address;
  readonly label: string | null;
  readonly winRate: number; // 0..1 over closed trades
  readonly realizedPnlSol: number;
  readonly tradeCount: number;
  /** Median minutes between a token's launch and this wallet's first buy. */
  readonly earlinessMinutes: number | null;
  readonly archetype: "early-buyer" | "market-maker" | "influencer" | "high-winrate" | "unknown";
  readonly updatedAt: Timestamp;
}

/**
 * The smart-money engine contract. Implement against Helius/Geyser to make it
 * live; the `DexProvider` rotation already knows how to consume the signals
 * this emits (source: "smart-money" | "whale-move").
 */
export interface WalletTracker {
  readonly id: string;
  /** Wallets currently being tracked, best first. */
  profiles(): Promise<WalletProfile[]>;
  /** Fresh signals derived from recent tracked-wallet activity. */
  discover(): Promise<DiscoverySignal[]>;
  /** Profitable wallets that bought a given mint, if any. */
  buyersOf(mint: Mint): Promise<WalletProfile[]>;
}

/**
 * Stub tracker — wires cleanly but emits nothing until you implement a real
 * data source. Kept so the interface ships in the core and the agent can
 * depend on it today. See docs/wallet-tracking.md for the Helius recipe.
 */
export class StubWalletTracker implements WalletTracker {
  readonly id = "stub";
  async profiles(): Promise<WalletProfile[]> {
    return [];
  }
  async discover(): Promise<DiscoverySignal[]> {
    return [];
  }
  async buyersOf(): Promise<WalletProfile[]> {
    return [];
  }
}
