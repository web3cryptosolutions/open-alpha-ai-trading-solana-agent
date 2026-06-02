import type { Strategy } from "@openalpha/types";

export interface MeanReversionOptions {
  /** Buy when 1h change is below this (e.g. -0.25 = bought a -25% dip). */
  dipThreshold?: number;
  /** Require the longer trend (6h) to still be positive — buy dips in uptrends. */
  requirePositive6h?: boolean;
  minRiskScore?: number;
}

/**
 * Mean reversion: fade sharp short-term drops in tokens whose larger trend is
 * still intact and whose risk is acceptable. Tight stop because a "dip" in a
 * dying token is just the way down.
 */
export function meanReversionStrategy(opts: MeanReversionOptions = {}): Strategy {
  const dip = opts.dipThreshold ?? -0.2;
  const requirePos6h = opts.requirePositive6h ?? true;
  const minRisk = opts.minRiskScore ?? 60;

  return {
    id: "mean-reversion",
    name: "Dip Fader",
    description: "Buys sharp short-term dips in tokens with an intact longer-term trend.",
    subscribes: ["trending", "volume-spike", "marketcap-growth", "holder-growth"],
    evaluate(ctx) {
      const { market, risk } = ctx;
      const h1 = market.priceChange.h1;
      const h6 = market.priceChange.h6;

      if (risk.score < minRisk) return null;
      if (h1 > dip) return null; // not a dip
      if (requirePos6h && h6 <= 0) return null; // trend not intact

      const depth = clamp01((dip - h1) / 0.4);
      const conviction = clamp01(0.4 + depth * 0.5) * (risk.score / 100);
      return {
        strategyId: "mean-reversion",
        action: "BUY",
        conviction,
        sizeFraction: clamp01(0.3 + depth * 0.5),
        exitPlan: { takeProfitPct: 0.25, stopLossPct: 0.12, trailingStopPct: null },
        rationale: `Faded ${(h1 * 100).toFixed(0)}% 1h dip; 6h trend still +${(h6 * 100).toFixed(0)}%, risk ${risk.score}/100.`,
      };
    },
  };
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
