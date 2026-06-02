export { Agent } from "./agent.ts";
export type { AgentDeps, CycleSummary } from "./agent.ts";
export { PositionManager } from "./position-manager.ts";
export { createAgent } from "./factory.ts";
export type { CreateAgentOptions } from "./factory.ts";
export { loadConfig } from "./config.ts";
export type { AgentConfig, RuntimeMode, EngineKind } from "./config.ts";

export type { DecisionEngine } from "./decision/engine.ts";
export { RulesDecisionEngine } from "./decision/rules-engine.ts";
export { ClaudeDecisionEngine } from "./decision/claude-engine.ts";
export type { ClaudeEngineOptions } from "./decision/claude-engine.ts";
