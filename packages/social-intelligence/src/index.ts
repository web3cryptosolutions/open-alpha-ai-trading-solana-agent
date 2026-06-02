import type { DiscoverySignal, Mint, Timestamp } from "@openalpha/types";

/** A rollup of social activity for a token over a time window. */
export interface SocialSnapshot {
  readonly mint: Mint;
  /** Mentions in the last hour across tracked platforms. */
  readonly mentions1h: number;
  /** Growth in mention rate vs the prior window (1.0 = +100%). */
  readonly mentionVelocity: number;
  /** Aggregate sentiment, -1 (bearish) .. 1 (bullish). */
  readonly sentiment: number;
  /** Count of tracked influential accounts mentioning it. */
  readonly influencerHits: number;
  readonly capturedAt: Timestamp;
}

/**
 * Social intelligence contract — turns X / Telegram / Discord chatter into a
 * discovery source and an extra evidence channel for the decision engine.
 * Implement against your data vendor; the agent consumes signals with
 * source "trending".
 */
export interface SocialIntelligence {
  readonly id: string;
  snapshot(mint: Mint): Promise<SocialSnapshot | null>;
  discover(): Promise<DiscoverySignal[]>;
}

/** Stub — ships the interface, emits nothing. See docs/social.md. */
export class StubSocialIntelligence implements SocialIntelligence {
  readonly id = "stub";
  async snapshot(): Promise<SocialSnapshot | null> {
    return null;
  }
  async discover(): Promise<DiscoverySignal[]> {
    return [];
  }
}
