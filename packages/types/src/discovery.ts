import type { Address, Dex, Mint, Timestamp } from "./token.ts";

/**
 * Why a token surfaced from the discovery layer. The agent treats different
 * sources with different prior confidence (e.g. "smart money bought" is a
 * stronger prior than "trending on a leaderboard").
 */
export type DiscoverySource =
  | "new-launch"
  | "liquidity-add"
  | "trending"
  | "smart-money"
  | "whale-move"
  | "volume-spike"
  | "holder-growth"
  | "marketcap-growth"
  | "dex-activity";

/**
 * A discovery signal: "this token is worth a look, for this reason, right now".
 * Discovery is intentionally cheap and high-recall — the risk and decision
 * engines downstream are responsible for precision.
 */
export interface DiscoverySignal {
  readonly id: string;
  readonly mint: Mint;
  readonly dex: Dex;
  readonly source: DiscoverySource;
  /** Source-local strength of the signal, 0..1. */
  readonly strength: number;
  /** Human-readable, one-line explanation of what triggered the signal. */
  readonly summary: string;
  /** Structured evidence backing the summary (varies by source). */
  readonly evidence: Record<string, number | string | boolean>;
  /** Wallets implicated, if this is a wallet-driven signal. */
  readonly wallets?: readonly Address[];
  readonly detectedAt: Timestamp;
}
