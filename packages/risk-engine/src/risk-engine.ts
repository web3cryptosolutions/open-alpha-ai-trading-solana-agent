import type {
  MarketSnapshot,
  RiskCheckResult,
  RiskLevel,
  RiskReport,
  TokenSecurity,
} from "@openalpha/types";
import { ALL_CHECKS, type RiskCheck } from "./checks.ts";

export interface RiskEngineOptions {
  /** Override the check set (e.g. for testing or stricter profiles). */
  checks?: readonly RiskCheck[];
  /** Score at/below which a token is "danger". Default 40. */
  dangerBelow?: number;
  /** Score at/below which a token is "caution". Default 70. */
  cautionBelow?: number;
  /**
   * How much an `unknown` check counts against the score (0..1). Defaults to
   * 0.4: we are uneasy about what we can't verify, but don't treat unknown as
   * outright failure.
   */
  unknownPenalty?: number;
}

/**
 * Composes independent checks into a single 0-100 risk score (100 = safest)
 * plus a coarse band. The math is intentionally simple and transparent:
 * a weighted average of per-check severities, inverted to a "safety" score.
 * Any hard-fail of a critical check (mint/freeze/LP) caps the score so a
 * great-looking token with a live mint authority can never read as "safe".
 */
export class RiskEngine {
  private readonly checks: readonly RiskCheck[];
  private readonly dangerBelow: number;
  private readonly cautionBelow: number;
  private readonly unknownPenalty: number;

  constructor(opts: RiskEngineOptions = {}) {
    this.checks = opts.checks ?? ALL_CHECKS;
    this.dangerBelow = opts.dangerBelow ?? 40;
    this.cautionBelow = opts.cautionBelow ?? 70;
    this.unknownPenalty = opts.unknownPenalty ?? 0.4;
  }

  assess(sec: TokenSecurity, market: MarketSnapshot): RiskReport {
    const results = this.checks.map((c) => c(sec, market));

    let weightedSeverity = 0;
    let totalWeight = 0;
    for (const res of results) {
      const sev = res.severity ?? (res.verdict === "unknown" ? this.unknownPenalty : 0);
      weightedSeverity += sev * res.weight;
      totalWeight += res.weight;
    }
    const meanSeverity = totalWeight > 0 ? weightedSeverity / totalWeight : 1;
    let score = Math.round((1 - meanSeverity) * 100);

    // Critical caps: certain failures are disqualifying regardless of the rest.
    score = Math.min(score, this.criticalCap(results));
    score = Math.max(0, Math.min(100, score));

    const topConcerns = [...results]
      .filter((c) => (c.severity ?? 0) > 0 || c.verdict === "fail" || c.verdict === "warn")
      .sort((a, b) => (b.severity ?? 0) * b.weight - (a.severity ?? 0) * a.weight)
      .slice(0, 4);

    return {
      mint: sec.mint,
      score,
      level: this.band(score),
      checks: results,
      topConcerns,
      assessedAt: market.observedAt,
    };
  }

  private criticalCap(results: readonly RiskCheckResult[]): number {
    const failed = new Set(results.filter((c) => c.verdict === "fail").map((c) => c.id));
    if (failed.has("mint-authority") || failed.has("freeze-authority")) return 25;
    if (failed.has("liquidity-locked")) return 30;
    if (failed.has("rug-history")) return 20;
    return 100;
  }

  private band(score: number): RiskLevel {
    if (score < this.dangerBelow) return "danger";
    if (score < this.cautionBelow) return "caution";
    return "safe";
  }
}
