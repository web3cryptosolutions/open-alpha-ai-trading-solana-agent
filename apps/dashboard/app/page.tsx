import { performance } from "@openalpha/analytics";
import type { Position } from "@openalpha/types";
import { loadState } from "../lib/load-state.ts";
import { AutoRefresh } from "./AutoRefresh.tsx";

export const dynamic = "force-dynamic";

const NAV = ["Overview", "Portfolio", "Trades", "Risk", "Wallets", "Strategies", "Agent Logs"];

export default async function Page() {
  const { state, source } = await loadState();
  const perf = performance(state.meta.startingSol, state.positions);
  const balance = state.meta.startingSol + perf.realizedPnlSol;
  const closed = state.positions.filter((p) => p.status === "closed").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const open = state.positions.filter((p) => p.status === "open");
  const recentDecisions = [...state.decisions].slice(-9).reverse();
  const events = [...state.events].slice(-40).reverse();
  const riskBands = bandCounts(state.decisions);

  return (
    <div className="layout">
      <AutoRefresh />
      <aside className="sidebar">
        <div className="brand"><span className="glyph">◎</span> Open Alpha</div>
        <nav className="nav">
          {NAV.map((n, i) => (
            <a key={n} className={i === 0 ? "active" : ""} href="#"><span className="dot" /> {n}</a>
          ))}
        </nav>
        <div className="foot">
          v0.1.0 · paper mode<br />
          {source ? `data: ${source.split("/").slice(-2).join("/")}` : "no data — run pnpm agent"}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>Overview</h1>
            <div className="sub">Autonomous Solana trading · every decision explained</div>
          </div>
          <span className="pill"><span className="pulse" /> agent live · {open.length} open</span>
        </div>

        {/* Stat cards */}
        <section className="stats">
          <Stat label="Equity" value={`${balance.toFixed(3)} SOL`} meta={`started ${state.meta.startingSol} SOL`} />
          <Stat label="Realized PnL" value={`${signed(perf.realizedPnlSol)} SOL`} meta={`${perf.realizedPnlPct}%`} tone={perf.realizedPnlSol >= 0 ? "pos" : "neg"} />
          <Stat label="Win rate" value={`${(perf.winRate * 100).toFixed(0)}%`} meta={`${perf.wins}W / ${perf.losses}L · PF ${fmtPF(perf.profitFactor)}`} />
          <Stat label="Max drawdown" value={`${perf.maxDrawdownPct}%`} meta={`${perf.closedTrades} closed · ${open.length} open`} />
        </section>

        <section className="grid2">
          <div className="panel">
            <div className="h-row"><h2>Equity curve</h2><span className="faint mono">{perf.closedTrades} trades</span></div>
            <EquityCurve points={perf.equityCurve.map((p) => p.equitySol)} start={state.meta.startingSol} />
          </div>
          <div className="panel">
            <h2>Risk distribution</h2>
            <RiskBar label="Safe" n={riskBands.safe} total={riskBands.total} cls="safe" />
            <RiskBar label="Caution" n={riskBands.caution} total={riskBands.total} cls="caution" />
            <RiskBar label="Danger" n={riskBands.danger} total={riskBands.total} cls="danger" />
            <p className="faint" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
              Across {riskBands.total} decisions. Tokens below the risk floor are never traded — the engine
              filtered {riskBands.danger} danger-rated tokens this run.
            </p>
          </div>
        </section>

        {/* Positions */}
        <section className="panel" style={{ marginBottom: 18 }}>
          <h2>Positions</h2>
          {state.positions.length === 0 ? (
            <Empty />
          ) : (
            <table>
              <thead><tr><th>Token</th><th>Status</th><th>Size</th><th>Entry</th><th>Exit</th><th>PnL</th><th>Reason</th></tr></thead>
              <tbody>
                {[...open, ...closed].slice(0, 12).map((p) => <PosRow key={p.id} p={p} />)}
              </tbody>
            </table>
          )}
        </section>

        <section className="grid2">
          <div className="panel">
            <h2>Recent decisions</h2>
            {recentDecisions.length === 0 ? <Empty /> : (
              <table>
                <thead><tr><th>Action</th><th>Risk</th><th>Conf</th><th>Reasoning</th></tr></thead>
                <tbody>
                  {recentDecisions.map((d, i) => (
                    <tr key={i}>
                      <td><span className={`badge ${d.action.toLowerCase()}`}>{d.action}</span></td>
                      <td><span className={`badge ${d.riskLevel ?? "ignore"}`}>{d.riskScore ?? "—"}</span></td>
                      <td className="mono">{(d.confidence * 100).toFixed(0)}%</td>
                      <td className="muted" style={{ maxWidth: 300 }}>{truncate(d.reasoning, 84)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="panel">
            <h2>Agent activity</h2>
            <div className="feed">
              {events.length === 0 ? <Empty /> : events.map((e) => (
                <div className="item" key={e.id}>
                  <span className={`tick ${e.level}`} />
                  <div>
                    <div className="msg">{e.message}</div>
                    <div className="ts">{clock(e.at)}{e.symbol ? ` · ${e.symbol}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, meta, tone }: { label: string; value: string; meta: string; tone?: "pos" | "neg" }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{value}</div>
      <div className="meta">{meta}</div>
    </div>
  );
}

function PosRow({ p }: { p: Position }) {
  const pnl = p.realizedPnlSol;
  const sym = p.mint.slice(0, 6) + "…";
  return (
    <tr>
      <td className="sym">{sym}</td>
      <td>{p.status === "open" ? <span className="badge watch">open</span> : <span className="badge ignore">closed</span>}</td>
      <td className="mono">{p.entrySol.toFixed(3)}</td>
      <td className="mono faint">{p.entryPriceSol.toExponential(2)}</td>
      <td className="mono faint">{p.exitPriceSol ? p.exitPriceSol.toExponential(2) : "—"}</td>
      <td className={`mono ${pnl == null ? "faint" : pnl >= 0 ? "pos" : "neg"}`}>{pnl == null ? "—" : `${signed(pnl)}`}</td>
      <td className="faint" style={{ fontSize: 12 }}>{p.exitReason ?? "—"}</td>
    </tr>
  );
}

function RiskBar({ label, n, total, cls }: { label: string; n: number; total: number; cls: string }) {
  const pctv = total ? (n / total) * 100 : 0;
  const color = cls === "safe" ? "var(--green)" : cls === "caution" ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span className={`badge ${cls}`}>{label}</span>
        <span className="mono faint">{n} · {pctv.toFixed(0)}%</span>
      </div>
      <div className="bar"><span style={{ width: `${pctv}%`, background: color }} /></div>
    </div>
  );
}

function EquityCurve({ points, start }: { points: number[]; start: number }) {
  const w = 560, h = 180, pad = 6;
  const data = points.length > 1 ? points : [start, start];
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  const up = data[data.length - 1]! >= start;
  const stroke = up ? "var(--green)" : "var(--red)";
  return (
    <svg className="equity" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? "#2ecf8f" : "#ff5b6e"} stopOpacity="0.18" />
          <stop offset="100%" stopColor={up ? "#2ecf8f" : "#ff5b6e"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#g)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}

function Empty() {
  return (
    <div className="empty">
      Nothing yet. Run <code>pnpm agent:backtest</code> or <code>pnpm agent</code> to populate.
    </div>
  );
}

function bandCounts(decisions: { riskLevel?: string }[]) {
  let safe = 0, caution = 0, danger = 0;
  for (const d of decisions) {
    if (d.riskLevel === "safe") safe++;
    else if (d.riskLevel === "caution") caution++;
    else if (d.riskLevel === "danger") danger++;
  }
  return { safe, caution, danger, total: safe + caution + danger };
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(4)}`;
const fmtPF = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "∞");
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
