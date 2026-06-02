import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { JsonStore } from "@openalpha/memory-engine";
import { performance, type PerformanceReport } from "@openalpha/analytics";
import type { Position } from "@openalpha/types";

export interface AgentStateView {
  dataDir: string | null;
  startingSol: number;
  balanceSol: number;
  performance: PerformanceReport;
  open: Position[];
  closedRecent: Position[];
  updatedAt: number;
}

/**
 * Resolve the data directory robustly. Apps may be launched from the repo root
 * or from their own package dir (pnpm --filter), so we probe the obvious spots
 * and pick the richest store — the same strategy the dashboard uses.
 */
function resolveDataDir(): string | null {
  const env = process.env.OPENALPHA_DATA_DIR;
  const cwd = process.cwd();
  const candidates = [
    env ? (isAbsolute(env) ? env : join(cwd, env)) : null,
    join(cwd, "data"),
    join(cwd, "../../data"),
    join(cwd, "../../data/backtest"),
  ].filter(Boolean) as string[];

  let best: { dir: string; richness: number } | null = null;
  for (const dir of candidates) {
    const file = join(dir, "memory.json");
    if (!existsSync(file)) continue;
    try {
      const s = JSON.parse(readFileSync(file, "utf8")) as { trades?: unknown[]; positions?: unknown[] };
      const richness = (s.trades?.length ?? 0) + (s.positions?.length ?? 0);
      if (!best || richness > best.richness) best = { dir, richness };
    } catch {
      /* skip */
    }
  }
  return best?.dir ?? null;
}

/** Reads the agent's local memory and projects the views the apps need. */
export function readState(dataDir = resolveDataDir()): AgentStateView {
  const dir = dataDir ?? "./data";
  const store = new JsonStore(dir, 10);
  const s = store.snapshot();
  const perf = performance(s.meta.startingSol, s.positions);
  return {
    dataDir: dataDir,
    startingSol: s.meta.startingSol,
    balanceSol: s.meta.startingSol + perf.realizedPnlSol,
    performance: perf,
    open: s.positions.filter((p) => p.status === "open"),
    closedRecent: s.positions
      .filter((p) => p.status === "closed")
      .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
      .slice(0, 10),
    updatedAt: s.meta.updatedAt,
  };
}

export { performance };
