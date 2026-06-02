import type { ExecutionResult, OrderRequest } from "@openalpha/types";
import type { Executor, QuoteSource } from "./executor.ts";

export interface PaperExecutorOptions {
  quoteSource: QuoteSource;
  startingSol: number;
  now: () => number;
  /** Simulated trading fee as a fraction (default 0.003 ~ Jupiter+DEX). */
  feeRate?: number;
  /** Base slippage applied even on tiny orders (default 0.005). */
  baseSlippage?: number;
}

/**
 * Simulates fills against live quotes with a realistic, *size-aware* slippage
 * model: the larger your order relative to pool liquidity, the worse your fill.
 * This is what lets paper results actually resemble live results instead of
 * the fantasy fills most bots backtest against. Keeps a virtual SOL balance.
 */
export class PaperExecutor implements Executor {
  readonly mode = "paper" as const;
  private sol: number;
  private readonly quoteSource: QuoteSource;
  private readonly now: () => number;
  private readonly feeRate: number;
  private readonly baseSlippage: number;
  private seq = 0;

  constructor(opts: PaperExecutorOptions) {
    this.sol = opts.startingSol;
    this.quoteSource = opts.quoteSource;
    this.now = opts.now;
    this.feeRate = opts.feeRate ?? 0.003;
    this.baseSlippage = opts.baseSlippage ?? 0.005;
  }

  balanceSol(): number {
    return this.sol;
  }

  async execute(order: OrderRequest): Promise<ExecutionResult> {
    const quote = await this.quoteSource(order.mint);
    const at = this.now();
    if (!quote || quote.priceSol <= 0) {
      return this.fail(order, at, "no quote available");
    }

    if (order.side === "buy") {
      const amountSol = order.amountSol ?? 0;
      if (amountSol <= 0) return this.fail(order, at, "buy amount must be > 0");
      if (amountSol > this.sol) return this.fail(order, at, "insufficient SOL balance");

      const slippage = this.slippageFor(amountSol * 150, quote.liquidityUsd);
      if (slippage > order.maxSlippage) return this.fail(order, at, `slippage ${(slippage * 100).toFixed(1)}% exceeds max`);

      const effPrice = quote.priceSol * (1 + slippage);
      const spendAfterFee = amountSol * (1 - this.feeRate);
      const tokens = spendAfterFee / effPrice;
      this.sol -= amountSol;
      return { ok: true, mode: this.mode, mint: order.mint, side: "buy", filledSol: amountSol, filledTokens: tokens, priceSol: effPrice, slippage, signature: this.sig("buy"), executedAt: at };
    }

    // sell
    const tokens = order.amountTokens ?? 0;
    if (tokens <= 0) return this.fail(order, at, "sell token amount must be > 0");
    const notionalSol = tokens * quote.priceSol;
    const slippage = this.slippageFor(notionalSol * 150, quote.liquidityUsd);
    const effPrice = quote.priceSol * (1 - slippage);
    const proceeds = tokens * effPrice * (1 - this.feeRate);
    this.sol += proceeds;
    return { ok: true, mode: this.mode, mint: order.mint, side: "sell", filledSol: proceeds, filledTokens: tokens, priceSol: effPrice, slippage, signature: this.sig("sell"), executedAt: at };
  }

  /** Price impact grows with order size as a fraction of pool liquidity. */
  private slippageFor(notionalUsd: number, liquidityUsd: number): number {
    if (liquidityUsd <= 0) return 1;
    const impact = notionalUsd / liquidityUsd; // crude constant-product proxy
    return this.baseSlippage + impact * 0.5;
  }

  private fail(order: OrderRequest, at: number, error: string): ExecutionResult {
    return { ok: false, mode: this.mode, mint: order.mint, side: order.side, filledSol: 0, filledTokens: 0, priceSol: 0, slippage: 0, signature: "", error, executedAt: at };
  }

  private sig(side: string): string {
    return `paper-${side}-${++this.seq}-${this.now()}`;
  }
}
