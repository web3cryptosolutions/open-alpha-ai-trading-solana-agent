import { readState } from "@openalpha/api";

/**
 * Pure command handlers: text in, Markdown out. Kept separate from transport
 * so they're trivially unit-testable and reusable by the Discord bot.
 */
export type Command = (args: string) => string;

const sol = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(4)}`;

export const commands: Record<string, Command> = {
  start: () =>
    [
      "*◎ Open Alpha* — autonomous Solana trading.",
      "",
      "Commands:",
      "/positions — open positions",
      "/pnl — performance scorecard",
      "/risk — recent risk filtering",
      "/strategies — active strategies",
      "/wallets — smart-money tracker",
      "/watchlist — tokens being watched",
    ].join("\n"),

  pnl: () => {
    const v = readState();
    const p = v.performance;
    return [
      "*📊 Performance*",
      `Equity: *${v.balanceSol.toFixed(3)} SOL*  (start ${v.startingSol})`,
      `Realized PnL: *${sol(p.realizedPnlSol)} SOL* (${p.realizedPnlPct}%)`,
      `Win rate: *${(p.winRate * 100).toFixed(0)}%*  (${p.wins}W / ${p.losses}L)`,
      `Profit factor: ${Number.isFinite(p.profitFactor) ? p.profitFactor : "∞"}  ·  Max DD ${p.maxDrawdownPct}%`,
      `Closed ${p.closedTrades} · Open ${p.openTrades}`,
    ].join("\n");
  },

  positions: () => {
    const v = readState();
    if (v.open.length === 0) return "No open positions.";
    return [
      "*📈 Open positions*",
      ...v.open.map((p) => `\`${p.mint.slice(0, 8)}…\`  ${p.entrySol.toFixed(3)} SOL @ ${p.entryPriceSol.toExponential(2)}`),
    ].join("\n");
  },

  risk: () => {
    const v = readState();
    const closed = v.closedRecent;
    if (closed.length === 0) return "No closed trades yet.";
    return [
      "*🛡️ Recent exits*",
      ...closed.slice(0, 6).map((p) => `\`${p.mint.slice(0, 8)}…\`  ${p.exitReason}  ${sol(p.realizedPnlSol ?? 0)} SOL`),
    ].join("\n");
  },

  strategies: () =>
    [
      "*🧠 Active strategies*",
      "• *Momentum Rider* — buys strong, well-funded 1h momentum.",
      "• *Dip Fader* — fades sharp dips in intact uptrends.",
      "",
      "Add your own by implementing the `Strategy` interface — see docs/strategies.md.",
    ].join("\n"),

  wallets: () => "*👛 Smart-money tracker* is interface-ready (stub). Wire a Helius adapter to populate — see docs/wallet-tracking.md.",

  watchlist: () => {
    const v = readState();
    return v.open.length
      ? `Watching ${v.open.length} held token(s). Use /positions for detail.`
      : "Watchlist empty — the agent surfaces candidates each cycle.";
  },
};

export function handle(text: string): string {
  const [raw, ...rest] = text.trim().split(/\s+/);
  const name = (raw ?? "").replace(/^\//, "").split("@")[0]!.toLowerCase();
  const cmd = commands[name];
  return cmd ? cmd(rest.join(" ")) : "Unknown command. Try /start.";
}
