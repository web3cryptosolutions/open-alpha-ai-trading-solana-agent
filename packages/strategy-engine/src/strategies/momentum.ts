import type { Strategy } from "@openalpha/types";

export interface MomentumOptions {
  /** Minimum 1h price change to consider a buy (0.12 = +12%). */
  minH1Change?: number;
  /** Minimum 1h volume in USD. */
  minVolumeH1?: number;
  /** Don't touch tokens whose risk score is below this. */
  minRiskScore?: number;
}

/**
 * Classic momentum: buy strength, ride it with a trailing stop, bail if the
 * move stalls. Conviction scales with how strong and how well-funded the move
 * is, dampened by risk. Intentionally simple — it's the reference example for
 * the strategy plugin contract.
 */
export function momentumStrategy(opts: MomentumOptions = {}): Strategy {
  const minH1 = opts.minH1Change ?? 0.12;
  const minVol = opts.minVolumeH1 ?? 25_000;
  const minRisk = opts.minRiskScore ?? 55;

  return {
    id: "momentum",
    name: "Momentum Rider",
    description: "Buys tokens with strong, well-funded 1h momentum; exits on stall or trailing stop.",
    subscribes: ["volume-spike", "trending", "smart-money", "new-launch", "marketcap-growth"],
    evaluate(ctx) {
      const { market, risk } = ctx;
      const h1 = market.priceChange.h1;
      const vol = market.volume.h1;

      // Exit/avoid: momentum has rolled over.
      if (h1 < -0.1) {
        return {
          strategyId: "momentum",
          action: "SELL",
          conviction: clamp01(Math.abs(h1)),
          sizeFraction: 1,
          exitPlan: { takeProfitPct: null, stopLossPct: null, trailingStopPct: null },
          rationale: `Momentum reversed (1h ${(h1 * 100).toFixed(0)}%); exit.`,
        };
      }

      if (risk.score < minRisk || h1 < minH1 || vol < minVol) {
        // Not enough edge to act, but keep it on the radar if mildly positive.
        return h1 > 0.04
          ? {
              strategyId: "momentum",
              action: "WATCH",
              conviction: 0.3,
              sizeFraction: 0,
              exitPlan: { takeProfitPct: null, stopLossPct: null, trailingStopPct: null },
              rationale: `Building (1h ${(h1 * 100).toFixed(0)}%) but below entry thresholds.`,
            }
          : null;
      }

      const strength = clamp01((h1 - minH1) / 0.5);
      const volBoost = clamp01(vol / 150_000);
      const conviction = clamp01(0.45 + strength * 0.4 + volBoost * 0.15) * (risk.score / 100);

      return {
        strategyId: "momentum",
        action: "BUY",
        conviction,
        sizeFraction: clamp01(0.4 + conviction * 0.6),
        exitPlan: { takeProfitPct: 0.6, stopLossPct: 0.2, trailingStopPct: 0.18 },
        rationale: `Strong momentum: 1h ${(h1 * 100).toFixed(0)}%, vol $${Math.round(vol / 1000)}k, risk ${risk.score}/100.`,
      };
    },
  };
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
