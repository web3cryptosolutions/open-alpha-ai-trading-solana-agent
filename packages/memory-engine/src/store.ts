import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AgentEvent, Decision, Position, TradeMemory } from "@openalpha/types";

/** The full persisted shape of the agent's local memory. */
export interface StoreState {
  readonly version: 1;
  decisions: Decision[];
  trades: TradeMemory[];
  positions: Position[];
  events: AgentEvent[];
  meta: {
    startingSol: number;
    updatedAt: number;
  };
}

function emptyState(startingSol: number): StoreState {
  return {
    version: 1,
    decisions: [],
    trades: [],
    positions: [],
    events: [],
    meta: { startingSol, updatedAt: 0 },
  };
}

/**
 * A dead-simple, dependency-free, local-first JSON store. Writes atomically
 * (temp file + rename) so a crash mid-write never corrupts your history. Good
 * enough for single-agent local use; swap for SQLite/Postgres behind the same
 * `Store` shape when you outgrow it.
 */
export class JsonStore {
  readonly path: string;
  private state: StoreState;
  /** Cap kept in memory/disk so the file doesn't grow unbounded. */
  private readonly maxEvents = 5_000;

  constructor(dataDir: string, startingSol: number, fileName = "memory.json") {
    this.path = join(dataDir, fileName);
    if (existsSync(this.path)) {
      try {
        this.state = JSON.parse(readFileSync(this.path, "utf8")) as StoreState;
      } catch {
        this.state = emptyState(startingSol);
      }
    } else {
      this.state = emptyState(startingSol);
    }
  }

  snapshot(): Readonly<StoreState> {
    return this.state;
  }

  /**
   * Wipe all history, keeping the configured starting balance. Used by the
   * backtester so every run starts from a clean, reproducible slate rather
   * than accumulating onto a previous run's persisted state.
   */
  reset(startingSol: number): void {
    this.state = emptyState(startingSol);
  }

  addDecision(d: Decision): void {
    this.state.decisions.push(d);
  }

  addEvent(e: AgentEvent): void {
    this.state.events.push(e);
    if (this.state.events.length > this.maxEvents) {
      this.state.events.splice(0, this.state.events.length - this.maxEvents);
    }
  }

  upsertPosition(p: Position): void {
    const i = this.state.positions.findIndex((x) => x.id === p.id);
    if (i >= 0) this.state.positions[i] = p;
    else this.state.positions.push(p);
  }

  addTrade(m: TradeMemory): void {
    const i = this.state.trades.findIndex((x) => x.id === m.id);
    if (i >= 0) this.state.trades[i] = m;
    else this.state.trades.push(m);
  }

  openPositions(): Position[] {
    return this.state.positions.filter((p) => p.status === "open");
  }

  flush(now: number): void {
    this.state.meta.updatedAt = now;
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    renameSync(tmp, this.path);
  }
}
