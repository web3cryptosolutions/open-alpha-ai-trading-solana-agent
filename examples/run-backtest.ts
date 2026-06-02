/**
 * Backtest the agent over 24h of deterministic simulated market, then print
 * the scorecard. Same seed => same result, every time.
 *
 *   pnpm agent:backtest
 *   OPENALPHA_SEED=degen pnpm agent:backtest
 */
import { backtest } from "@openalpha/simulation-engine";
import { loadConfig } from "@openalpha/core-agent";

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

// Use an isolated data dir so backtests never clobber the live agent's memory.
const config = { ...loadConfig(), dataDir: "./data/backtest" };

// Fixed virtual start so the run is fully reproducible.
const START = 1_750_000_000_000;

console.log(c.bold("\n  ◎ Open Alpha — Backtest") + c.dim(`  seed=${config.seed}  starting=${config.startingSol} SOL`));
console.log(c.dim("  simulating 24h at 5-minute resolution…\n"));

const result = await backtest({
  config,
  startMs: START,
  stepMinutes: 5,
  steps: 288,
});

const r = result.report;
const pnl = `${r.realizedPnlSol >= 0 ? "+" : ""}${r.realizedPnlSol.toFixed(4)} SOL (${r.realizedPnlPct}%)`;
const row = (k: string, v: string) => console.log(`  ${k.padEnd(20)} ${v}`);

console.log(c.bold("  ── scorecard ─────────────────────────────────────────"));
row("cycles", String(result.cycles));
row("decisions", String(result.decisions));
row("closed trades", String(r.closedTrades));
row("win rate", `${(r.winRate * 100).toFixed(1)}%  (${r.wins}W / ${r.losses}L)`);
row("realized PnL", r.realizedPnlSol >= 0 ? c.green(pnl) : c.red(pnl));
row("expectancy", `${r.expectancySol.toFixed(4)} SOL / trade`);
row("profit factor", String(r.profitFactor));
row("avg win / loss", `${r.avgWinSol.toFixed(4)} / -${r.avgLossSol.toFixed(4)} SOL`);
row("best / worst", `${r.bestTradeSol.toFixed(4)} / ${r.worstTradeSol.toFixed(4)} SOL`);
row("max drawdown", `${r.maxDrawdownPct}%`);
row("final balance", `${result.finalBalanceSol.toFixed(4)} SOL`);
console.log(c.dim("\n  results written to ./data/backtest/memory.json\n"));
