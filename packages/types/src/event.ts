import type { Action } from "./decision.ts";
import type { Mint, Timestamp } from "./token.ts";

/** Severity for the agent's decision log / activity feed. */
export type EventLevel = "debug" | "info" | "warn" | "trade";

/**
 * A single line in the agent's narrated activity log. Everything the agent
 * does emits one of these, which is what powers the "explain every decision"
 * promise in the dashboard and bots.
 */
export interface AgentEvent {
  readonly id: string;
  readonly level: EventLevel;
  readonly kind:
    | "cycle-start"
    | "discovered"
    | "assessed"
    | "decided"
    | "opened"
    | "closed"
    | "skipped"
    | "guardrail"
    | "error";
  readonly message: string;
  readonly mint?: Mint;
  readonly symbol?: string;
  readonly action?: Action;
  readonly data?: Record<string, number | string | boolean | null>;
  readonly at: Timestamp;
}
