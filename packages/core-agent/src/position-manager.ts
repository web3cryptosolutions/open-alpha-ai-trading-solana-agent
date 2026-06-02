import type { Decision, ExitPlan, ExitReason, Position } from "@openalpha/types";
import type { Executor } from "@openalpha/execution-engine";

export interface OpenResult {
  readonly position: Position | null;
  readonly error?: string;
}

/**
 * Owns the lifecycle of a position: turning a BUY decision into an executed
 * entry, then on every tick checking the live price against the exit plan
 * (take-profit, stop-loss, trailing stop) and closing when triggered. All exit
 * logic lives here so strategies stay declarative.
 */
export class PositionManager {
  constructor(private readonly executor: Executor) {}

  async open(decision: Decision, sizeSol: number, exitPlan: ExitPlan): Promise<OpenResult> {
    const res = await this.executor.execute({
      mint: decision.mint,
      side: "buy",
      type: "market",
      amountSol: sizeSol,
      maxSlippage: 0.15,
    });
    if (!res.ok) return { position: null, error: res.error };

    const position: Position = {
      id: `pos-${res.signature}`,
      mint: decision.mint,
      status: "open",
      mode: this.executor.mode,
      entrySol: res.filledSol,
      entryPriceSol: res.priceSol,
      tokens: res.filledTokens,
      exitPlan,
      highWaterPriceSol: res.priceSol,
      openedAt: res.executedAt,
      closedAt: null,
      exitPriceSol: null,
      realizedPnlSol: null,
      entryDecisionId: `${decision.mint}-${decision.decidedAt}`,
      exitReason: null,
    };
    return { position };
  }

  /**
   * Re-evaluate an open position against the current price. Returns the
   * (possibly updated) position and whether it was just closed.
   */
  async tick(position: Position, currentPriceSol: number): Promise<{ position: Position; closed: boolean }> {
    if (position.status !== "open") return { position, closed: false };

    const highWater = Math.max(position.highWaterPriceSol, currentPriceSol);
    const changePct = currentPriceSol / position.entryPriceSol - 1;
    const drawFromHigh = highWater > 0 ? currentPriceSol / highWater - 1 : 0;
    const { takeProfitPct, stopLossPct, trailingStopPct } = position.exitPlan;

    let reason: ExitReason | null = null;
    if (takeProfitPct !== null && changePct >= takeProfitPct) reason = "take-profit";
    else if (stopLossPct !== null && changePct <= -stopLossPct) reason = "stop-loss";
    else if (trailingStopPct !== null && drawFromHigh <= -trailingStopPct) reason = "trailing-stop";

    if (!reason) {
      return { position: { ...position, highWaterPriceSol: highWater }, closed: false };
    }

    const sell = await this.executor.execute({
      mint: position.mint,
      side: "sell",
      type: "market",
      amountTokens: position.tokens,
      maxSlippage: 0.2,
    });
    const proceeds = sell.ok ? sell.filledSol : 0;
    const closed: Position = {
      ...position,
      status: "closed",
      highWaterPriceSol: highWater,
      closedAt: sell.executedAt,
      exitPriceSol: sell.ok ? sell.priceSol : currentPriceSol,
      realizedPnlSol: proceeds - position.entrySol,
      exitReason: reason,
    };
    return { position: closed, closed: true };
  }
}
