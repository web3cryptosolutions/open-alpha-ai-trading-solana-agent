import type { ExecutionResult, OrderRequest } from "@openalpha/types";
import type { Executor } from "./executor.ts";

/**
 * Live execution via Jupiter — INTENTIONALLY a stub in the open-source core.
 *
 * The full implementation builds a Jupiter v6 quote + swap transaction, signs
 * it with the configured keypair, and submits via the RPC. It is gated behind
 * `OPENALPHA_MODE=live` and a funded keypair so nobody accidentally trades
 * real money by cloning the repo. Wiring guide: docs/execution.md.
 *
 * Implement `execute()` here and the rest of the system uses it unchanged —
 * that's the whole point of the `Executor` interface.
 */
export class JupiterExecutor implements Executor {
  readonly mode = "live" as const;

  constructor(_opts: { rpcUrl: string; keypairPath: string; jupiterApiUrl: string }) {
    // Real impl: load keypair, init Connection. See docs/execution.md.
  }

  balanceSol(): number {
    throw new Error("JupiterExecutor is a stub. Implement live execution before using OPENALPHA_MODE=live.");
  }

  async execute(_order: OrderRequest): Promise<ExecutionResult> {
    throw new Error(
      "Live Jupiter execution is not implemented in the open-source core by design. " +
        "See docs/execution.md to wire it up, and never run live mode with funds you can't lose.",
    );
  }
}
