/**
 * Run the autonomous agent live against the deterministic mock market.
 *
 *   pnpm agent              # one cycle, pretty-printed
 *   LOOP=1 pnpm agent       # keep running every few seconds
 *
 * Zero keys, zero funds. Flip DECISION_ENGINE=claude (+ ANTHROPIC_API_KEY) to
 * swap the rules brain for Claude.
 */
import { createAgent, loadConfig } from "@openalpha/core-agent";
import { performance } from "@openalpha/analytics";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const config = loadConfig();
const { agent, deps } = createAgent({ config });

console.log(c.bold("\n  ◎ Open Alpha — Autonomous Trading OS"));
console.log(c.dim(`  mode=${config.mode}  engine=${deps.decisionEngine.id}  starting=${config.startingSol} SOL\n`));

function printState(): void {
  const state = deps.store.snapshot();
  const perf = performance(config.startingSol, state.positions);
  const open = deps.store.openPositions();

  console.log(c.cyan("  ── activity ──────────────────────────────────────────"));
  for (const e of state.events.slice(-8)) {
    const tag = e.level === "trade" ? c.green("●") : e.level === "warn" ? c.yellow("▲") : c.dim("·");
    console.log(`  ${tag} ${e.message}`);
  }

  console.log(c.cyan("\n  ── portfolio ─────────────────────────────────────────"));
  console.log(`  balance ${c.bold(deps.executor.balanceSol().toFixed(3))} SOL   open ${open.length}   closed ${perf.closedTrades}`);
  const pnlStr = `${perf.realizedPnlSol >= 0 ? "+" : ""}${perf.realizedPnlSol.toFixed(4)} SOL (${perf.realizedPnlPct}%)`;
  console.log(`  realized PnL ${perf.realizedPnlSol >= 0 ? c.green(pnlStr) : c.red(pnlStr)}   win rate ${(perf.winRate * 100).toFixed(0)}%   PF ${perf.profitFactor}`);
  for (const p of open) {
    console.log(c.dim(`    holding ${p.mint.slice(0, 8)}…  ${p.entrySol.toFixed(3)} SOL @ ${p.entryPriceSol.toExponential(2)}`));
  }
  console.log("");
}

async function once(): Promise<void> {
  const summary = await agent.runCycle();
  console.clear();
  console.log(c.bold("  ◎ Open Alpha") + c.dim(`   evaluated ${summary.evaluated} · opened ${summary.opened} · closed ${summary.closed}\n`));
  printState();
}

if (process.env.LOOP === "1") {
  console.log(c.dim("  looping every 4s — Ctrl+C to stop\n"));
  for (;;) {
    await once();
    await new Promise((r) => setTimeout(r, 4000));
  }
} else {
  await once();
  console.log(c.dim("  tip: LOOP=1 pnpm agent  to run continuously · pnpm agent:backtest to score a 24h sim\n"));
}
