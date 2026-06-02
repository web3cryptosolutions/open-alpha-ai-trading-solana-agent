import type {
  ChangeWindows,
  DiscoverySignal,
  DiscoverySource,
  Dex,
  MarketSnapshot,
  Mint,
  Pool,
  TokenMeta,
  TokenSecurity,
} from "@openalpha/types";
import type { DexProvider, ProviderOptions } from "../provider.ts";
import { hashSeed, mulberry32, noise } from "../rng.ts";

/**
 * Token archetypes. Each one produces a distinct, *deterministic* price path
 * and security profile so the downstream engines see a realistic mix of
 * winners, choppers, bleeders and outright rugs — with no network, no keys.
 */
type Archetype = "gem" | "runner" | "chop" | "bleeder" | "rug";

interface MockToken {
  readonly meta: TokenMeta;
  readonly pool: Pool;
  readonly archetype: Archetype;
  readonly birthMs: number;
  readonly basePriceSol: number;
  readonly baseLiqUsd: number;
  readonly source: DiscoverySource;
}

const SOL_USD = 150;
const ARCHETYPES: Archetype[] = ["gem", "runner", "chop", "bleeder", "rug"];
const SOURCES: DiscoverySource[] = [
  "new-launch",
  "liquidity-add",
  "volume-spike",
  "smart-money",
  "trending",
  "holder-growth",
];

export interface MockProviderOptions extends ProviderOptions {
  /** Master seed for the whole universe. Same seed => same market. */
  seed?: string;
  /** How many tokens live in the universe. */
  universeSize?: number;
}

/**
 * A fully self-contained, deterministic Solana market. Implements the same
 * `DexProvider` interface a real Birdeye/Helius adapter would, so you can
 * develop and backtest the entire brain before touching a real RPC.
 */
export class MockDexProvider implements DexProvider {
  readonly id = "mock";
  private readonly now: () => number;
  private readonly universe: MockToken[];
  private readonly byMint = new Map<string, MockToken>();

  constructor(opts: MockProviderOptions) {
    this.now = opts.now;
    const seed = opts.seed ?? "open-alpha";
    const size = opts.universeSize ?? 24;
    const rnd = mulberry32(hashSeed(seed));
    const dexes: Dex[] = ["pumpfun", "raydium", "meteora", "orca", "jupiter"];
    const t0 = opts.now();

    this.universe = Array.from({ length: size }, (_, i) => {
      const archetype = ARCHETYPES[Math.floor(rnd() * ARCHETYPES.length)]!;
      const dex = dexes[Math.floor(rnd() * dexes.length)]!;
      const mint = `MoCk${seed.slice(0, 3)}${i.toString().padStart(3, "0")}${"x".repeat(28)}`.slice(0, 44) as Mint;
      // Tokens are "born" spread across the last few hours so ages vary.
      const birthMs = t0 - Math.floor(rnd() * 6 * 60 * 60_000);
      const basePriceSol = (0.0000002 + rnd() * 0.0000098);
      const baseLiqUsd = archetype === "rug" ? 3_000 + rnd() * 12_000 : 15_000 + rnd() * 220_000;
      const symbol = mockSymbol(rnd);
      const token: MockToken = {
        archetype,
        birthMs,
        basePriceSol,
        baseLiqUsd,
        source: SOURCES[Math.floor(rnd() * SOURCES.length)]!,
        meta: {
          mint,
          symbol,
          name: `${symbol} (${archetype})`,
          decimals: 6,
          createdAt: birthMs,
          logoUri: null,
        },
        pool: {
          dex,
          address: `pool${i.toString().padStart(4, "0")}${"P".repeat(40)}`.slice(0, 44) as Pool["address"],
          baseMint: mint,
          quoteMint: "So11111111111111111111111111111111111111112" as Mint,
          liquidityUsd: baseLiqUsd,
          createdAt: birthMs + 1000,
        },
      };
      this.byMint.set(mint, token);
      return token;
    });
  }

  /** Expose the universe for backtesting drivers. */
  list(): readonly Mint[] {
    return this.universe.map((t) => t.meta.mint);
  }

  async discover(): Promise<DiscoverySignal[]> {
    const now = this.now();
    // Surface tokens whose recent momentum or freshness makes them notable.
    const signals: DiscoverySignal[] = [];
    for (const t of this.universe) {
      const snap = this.snapshot(t, now);
      const ageMin = (now - t.birthMs) / 60_000;
      const interesting =
        ageMin < 30 || Math.abs(snap.priceChange.h1) > 0.15 || snap.volume.h1 > 40_000;
      if (!interesting) continue;
      const strength = clamp01(
        0.3 + Math.abs(snap.priceChange.h1) * 1.5 + (ageMin < 30 ? 0.3 : 0),
      );
      signals.push({
        id: `${t.meta.mint}-${Math.floor(now / 60_000)}`,
        mint: t.meta.mint,
        dex: t.pool.dex,
        source: t.source,
        strength,
        summary: summarize(t.source, snap, ageMin),
        evidence: {
          priceChangeH1: round(snap.priceChange.h1, 4),
          volumeH1: Math.round(snap.volume.h1),
          ageMinutes: Math.round(ageMin),
          liquidityUsd: Math.round(snap.liquidityUsd),
        },
        detectedAt: now,
      });
    }
    return signals.sort((a, b) => b.strength - a.strength);
  }

  async getSnapshot(mint: Mint): Promise<MarketSnapshot | null> {
    const t = this.byMint.get(mint);
    return t ? this.snapshot(t, this.now()) : null;
  }

  async getSecurity(mint: Mint): Promise<TokenSecurity | null> {
    const t = this.byMint.get(mint);
    if (!t) return null;
    const now = this.now();
    const ageMin = (now - t.birthMs) / 60_000;
    const r = mulberry32(hashSeed(`${mint}:security`));
    const dangerous = t.archetype === "rug";
    return {
      mint,
      mintAuthority: dangerous && r() < 0.7 ? ("DangerMintAuth1111111111111111111111111111" as TokenSecurity["mintAuthority"]) : null,
      freezeAuthority: dangerous && r() < 0.5 ? ("DangerFreezeAuth111111111111111111111111111" as TokenSecurity["freezeAuthority"]) : null,
      lpLocked: dangerous ? r() < 0.2 : r() < 0.85,
      lpConcentration: dangerous ? 0.6 + r() * 0.39 : 0.05 + r() * 0.4,
      top10HolderPct: dangerous ? 0.55 + r() * 0.4 : 0.12 + r() * 0.33,
      devHoldingPct: dangerous ? 0.2 + r() * 0.3 : r() * 0.08,
      bundledWallets: dangerous ? Math.floor(8 + r() * 30) : Math.floor(r() * 4),
      walletClusters: dangerous ? Math.floor(3 + r() * 6) : Math.floor(r() * 2),
      deployerRugCount: dangerous ? Math.floor(r() * 4) : 0,
      tokenAgeMinutes: Math.round(ageMin),
      liquidityAgeMinutes: Math.round(ageMin),
      fetchedAt: now,
    };
  }

  // ── price path ──────────────────────────────────────────────────────────
  private priceFactor(t: MockToken, ageMin: number): number {
    const n = (k: string) => noise(`${t.meta.mint}:${k}`, ageMin / 5);
    switch (t.archetype) {
      case "gem":
        return Math.max(0.2, 1 + ageMin * 0.006 + n("g") * 0.08);
      case "runner": {
        const pump = 1 + Math.min(ageMin, 90) * 0.03;
        return Math.max(0.3, pump + n("r") * 0.12);
      }
      case "chop":
        return Math.max(0.4, 1 + Math.sin(ageMin / 12) * 0.18 + n("c") * 0.06);
      case "bleeder":
        return Math.max(0.05, 1 - ageMin * 0.004 + n("b") * 0.05);
      case "rug": {
        // Pumps for ~25m, then liquidity is pulled and it craters.
        if (ageMin < 25) return 1 + ageMin * 0.05 + n("p") * 0.1;
        return Math.max(0.02, 2.25 - (ageMin - 25) * 0.25);
      }
    }
  }

  private snapshot(t: MockToken, now: number): MarketSnapshot {
    const ageMin = Math.max(0, (now - t.birthMs) / 60_000);
    const f = this.priceFactor(t, ageMin);
    const priceSol = t.basePriceSol * f;
    const priceUsd = priceSol * SOL_USD;
    const liqFactor = t.archetype === "rug" && ageMin > 25 ? Math.max(0.05, 1 - (ageMin - 25) * 0.3) : f;
    const liquidityUsd = t.baseLiqUsd * liqFactor;
    const change = (mins: number): number => {
      const past = this.priceFactor(t, Math.max(0, ageMin - mins));
      return past === 0 ? 0 : f / past - 1;
    };
    const priceChange: ChangeWindows = {
      m5: round(change(5), 4),
      h1: round(change(60), 4),
      h6: round(change(360), 4),
      h24: round(change(1440), 4),
    };
    const volBase = liquidityUsd * (0.4 + Math.abs(priceChange.h1) * 2);
    const supply = 1_000_000_000;
    return {
      token: t.meta,
      pool: { ...t.pool, liquidityUsd },
      priceUsd,
      priceSol,
      marketCapUsd: priceUsd * supply,
      fdvUsd: priceUsd * supply,
      liquidityUsd,
      volume: {
        m5: Math.round(volBase * 0.05),
        h1: Math.round(volBase * 0.5),
        h6: Math.round(volBase * 2),
        h24: Math.round(volBase * 6),
      },
      priceChange,
      holderCount: Math.max(10, Math.round(50 + ageMin * (t.archetype === "rug" ? 0.5 : 4))),
      holderChange: null,
      txns: {
        m5: { buys: 10 + Math.floor(ageMin) % 30, sells: 8 + Math.floor(ageMin) % 20 },
        h1: { buys: 120, sells: 90 },
        h24: { buys: 1400, sells: 1100 },
      },
      observedAt: now,
    };
  }
}

function mockSymbol(rnd: () => number): string {
  const syl = ["MOON", "PEPE", "BONK", "WIF", "SOL", "DOGE", "CHAD", "INU", "GIGA", "FOMO", "APE", "RUG"];
  return syl[Math.floor(rnd() * syl.length)]! + Math.floor(rnd() * 90 + 10);
}

function summarize(source: DiscoverySource, snap: MarketSnapshot, ageMin: number): string {
  const pct = (snap.priceChange.h1 * 100).toFixed(1);
  switch (source) {
    case "new-launch":
      return `New launch ${Math.round(ageMin)}m old, $${Math.round(snap.liquidityUsd / 1000)}k liquidity`;
    case "volume-spike":
      return `1h volume $${Math.round(snap.volume.h1 / 1000)}k, price ${pct}%`;
    case "smart-money":
      return `Tracked profitable wallet bought; 1h ${pct}%`;
    default:
      return `${source}: 1h ${pct}%, $${Math.round(snap.liquidityUsd / 1000)}k liq`;
  }
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const round = (x: number, dp: number): number => Number(x.toFixed(dp));
