import { readState } from "@openalpha/api";

/** Discord slash-command definitions, ready to register with the API. */
export const SLASH_COMMANDS = [
  { name: "pnl", description: "Show the agent's performance scorecard" },
  { name: "positions", description: "List open positions" },
  { name: "risk", description: "Show recent risk-based exits" },
  { name: "strategies", description: "List active strategies" },
  { name: "wallets", description: "Smart-money tracker status" },
] as const;

/** Pure handler returning a Discord embed payload for a command name. */
export function embedFor(name: string): { title: string; description: string; color: number } {
  const v = readState();
  switch (name) {
    case "pnl": {
      const p = v.performance;
      return {
        title: "📊 Performance",
        description: `**Equity** ${v.balanceSol.toFixed(3)} SOL\n**Realized PnL** ${p.realizedPnlSol >= 0 ? "+" : ""}${p.realizedPnlSol.toFixed(4)} SOL (${p.realizedPnlPct}%)\n**Win rate** ${(p.winRate * 100).toFixed(0)}% (${p.wins}W/${p.losses}L)\n**Closed** ${p.closedTrades} · **Open** ${p.openTrades}`,
        color: p.realizedPnlSol >= 0 ? 0x2ecf8f : 0xff5b6e,
      };
    }
    case "positions":
      return {
        title: "📈 Open positions",
        description: v.open.length
          ? v.open.map((p) => `\`${p.mint.slice(0, 8)}…\` ${p.entrySol.toFixed(3)} SOL`).join("\n")
          : "No open positions.",
        color: 0x5b8cff,
      };
    case "strategies":
      return { title: "🧠 Strategies", description: "Momentum Rider · Dip Fader\nAdd your own via the Strategy interface.", color: 0x5b8cff };
    case "wallets":
      return { title: "👛 Smart money", description: "Tracker interface-ready (stub). Wire Helius to populate.", color: 0x9aa3b2 };
    default:
      return { title: "Open Alpha", description: "Unknown command.", color: 0x9aa3b2 };
  }
}
