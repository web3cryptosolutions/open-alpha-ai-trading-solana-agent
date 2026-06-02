import type { LearnedPattern, MarketFingerprint, TradeMemory } from "@openalpha/types";
import { JsonStore } from "./store.ts";

/**
 * Turns raw trade history into something the agent can reason with:
 *  - `recall`: "what happened the last few times conditions looked like this?"
 *  - `patterns`: aggregated win-rates by setup, surfaced to the UI and engine.
 *
 * Similarity is a simple normalized distance over the fingerprint. It's
 * deliberately interpretable — no opaque embeddings — so a human can audit
 * why a given memory was recalled.
 */
export class MemoryEngine {
  constructor(private readonly store: JsonStore) {}

  /** Most similar completed trades to the given setup, nearest first. */
  recall(fp: MarketFingerprint, k = 5): TradeMemory[] {
    const completed = this.store.snapshot().trades.filter((t) => t.outcome !== null);
    return completed
      .map((t) => ({ t, d: distance(fp, t.entryConditions) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .map((x) => x.t);
  }

  /** Aggregate win-rate patterns grouped by discovery source. */
  patterns(now: number, minSample = 3): LearnedPattern[] {
    const completed = this.store.snapshot().trades.filter((t) => t.outcome);
    const groups = new Map<string, TradeMemory[]>();
    for (const t of completed) {
      const key = t.entryConditions.discoverySource;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
    }
    const out: LearnedPattern[] = [];
    for (const [source, trades] of groups) {
      if (trades.length < minSample) continue;
      const wins = trades.filter((t) => t.outcome!.result === "win").length;
      const winRate = wins / trades.length;
      const avgPnlPct = trades.reduce((s, t) => s + t.outcome!.realizedPnlPct, 0) / trades.length;
      out.push({
        id: `pattern:${source}`,
        label: `${source} setups`,
        description: `${trades.length} trades from "${source}" signals: ${(winRate * 100).toFixed(0)}% win rate, avg ${(avgPnlPct * 100).toFixed(1)}%.`,
        sampleSize: trades.length,
        winRate,
        avgPnlPct,
        recommends: winRate >= 0.5 && avgPnlPct > 0 ? "BUY" : "IGNORE",
        updatedAt: now,
      });
    }
    return out.sort((a, b) => b.winRate - a.winRate);
  }
}

/** Normalized Euclidean-ish distance over the comparable fingerprint fields. */
function distance(a: MarketFingerprint, b: MarketFingerprint): number {
  const terms = [
    norm(a.riskScore, b.riskScore, 100),
    norm(a.liquidityUsd, b.liquidityUsd, 200_000),
    norm(a.volumeH1, b.volumeH1, 200_000),
    norm(a.priceChangeH1, b.priceChangeH1, 1),
    a.discoverySource === b.discoverySource ? 0 : 1,
  ];
  return Math.sqrt(terms.reduce((s, t) => s + t * t, 0));
}

const norm = (x: number, y: number, scale: number): number => Math.abs(x - y) / scale;
