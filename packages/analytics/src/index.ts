import type { Position } from "@openalpha/types";

export interface EquityPoint {
  readonly at: number;
  readonly equitySol: number;
}

export interface PerformanceReport {
  readonly startingSol: number;
  readonly realizedPnlSol: number;
  readonly realizedPnlPct: number;
  readonly closedTrades: number;
  readonly openTrades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly avgWinSol: number;
  readonly avgLossSol: number;
  /** Average profit per trade in SOL — the core edge metric. */
  readonly expectancySol: number;
  /** Ratio of gross profit to gross loss; >1 is profitable. */
  readonly profitFactor: number;
  readonly bestTradeSol: number;
  readonly worstTradeSol: number;
  readonly maxDrawdownPct: number;
  readonly equityCurve: readonly EquityPoint[];
}

/**
 * Computes the standard trading scorecard from closed positions. Pure and
 * synchronous so it can run in the dashboard, a bot reply, or a test.
 */
export function performance(startingSol: number, positions: readonly Position[]): PerformanceReport {
  const closed = positions
    .filter((p) => p.status === "closed" && p.realizedPnlSol !== null && p.closedAt !== null)
    .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));

  const wins = closed.filter((p) => (p.realizedPnlSol ?? 0) > 0);
  const losses = closed.filter((p) => (p.realizedPnlSol ?? 0) < 0);
  const grossProfit = sum(wins.map((p) => p.realizedPnlSol ?? 0));
  const grossLoss = Math.abs(sum(losses.map((p) => p.realizedPnlSol ?? 0)));
  const realizedPnlSol = sum(closed.map((p) => p.realizedPnlSol ?? 0));

  // Equity curve & max drawdown.
  let equity = startingSol;
  let peak = startingSol;
  let maxDd = 0;
  const equityCurve: EquityPoint[] = [{ at: 0, equitySol: startingSol }];
  for (const p of closed) {
    equity += p.realizedPnlSol ?? 0;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - equity) / peak);
    equityCurve.push({ at: p.closedAt ?? 0, equitySol: round(equity) });
  }

  const pnls = closed.map((p) => p.realizedPnlSol ?? 0);
  return {
    startingSol,
    realizedPnlSol: round(realizedPnlSol),
    realizedPnlPct: startingSol > 0 ? round((realizedPnlSol / startingSol) * 100, 2) : 0,
    closedTrades: closed.length,
    openTrades: positions.filter((p) => p.status === "open").length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? round(wins.length / closed.length, 4) : 0,
    avgWinSol: wins.length ? round(grossProfit / wins.length) : 0,
    avgLossSol: losses.length ? round(grossLoss / losses.length) : 0,
    expectancySol: closed.length ? round(realizedPnlSol / closed.length) : 0,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 2) : grossProfit > 0 ? Infinity : 0,
    bestTradeSol: pnls.length ? round(Math.max(...pnls)) : 0,
    worstTradeSol: pnls.length ? round(Math.min(...pnls)) : 0,
    maxDrawdownPct: round(maxDd * 100, 2),
    equityCurve,
  };
}

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
const round = (x: number, dp = 6): number => Number(x.toFixed(dp));
