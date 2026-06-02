import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import type { AgentEvent, Decision, Position, TradeMemory } from "@openalpha/types";

/** Mirrors @openalpha/memory-engine's persisted shape (type-only, no dep). */
export interface StoreState {
  version: 1;
  decisions: Decision[];
  trades: TradeMemory[];
  positions: Position[];
  events: AgentEvent[];
  meta: { startingSol: number; updatedAt: number };
}

const EMPTY: StoreState = {
  version: 1,
  decisions: [],
  trades: [],
  positions: [],
  events: [],
  meta: { startingSol: 10, updatedAt: 0 },
};

function candidates(): string[] {
  const env = process.env.OPENALPHA_DATA_DIR;
  const root = process.cwd();
  const list = [
    env ? (isAbsolute(env) ? join(env, "memory.json") : join(root, env, "memory.json")) : null,
    join(root, "../../data/memory.json"),
    join(root, "../../data/backtest/memory.json"),
    join(root, "data/memory.json"),
  ].filter(Boolean) as string[];
  return list;
}

/**
 * Loads the agent's local memory file. Tries the configured data dir, then the
 * repo's live and backtest data, and returns the richest non-empty state so the
 * dashboard has something to show whether you've run the agent or a backtest.
 */
export async function loadState(): Promise<{ state: StoreState; source: string | null }> {
  let best: { state: StoreState; source: string } | null = null;
  for (const path of candidates()) {
    try {
      const raw = await readFile(path, "utf8");
      const state = JSON.parse(raw) as StoreState;
      const richness = (state.trades?.length ?? 0) + (state.positions?.length ?? 0);
      if (!best || richness > (best.state.trades.length + best.state.positions.length)) {
        best = { state, source: path };
      }
    } catch {
      // skip missing/invalid candidates
    }
  }
  return best ?? { state: EMPTY, source: null };
}
