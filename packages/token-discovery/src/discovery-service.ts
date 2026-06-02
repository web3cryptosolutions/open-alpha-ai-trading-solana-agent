import type { DiscoverySignal, Mint, MarketSnapshot, TokenSecurity } from "@openalpha/types";
import type { DexProvider } from "./provider.ts";

/**
 * Fans discovery out across every registered provider, de-duplicates by mint
 * (keeping the strongest signal per token), and offers snapshot/security
 * resolution that tries providers in order. Add a real adapter and it joins
 * the rotation with zero changes elsewhere.
 */
export class DiscoveryService {
  private readonly providers: DexProvider[];

  constructor(providers: DexProvider[]) {
    if (providers.length === 0) throw new Error("DiscoveryService needs at least one provider");
    this.providers = providers;
  }

  async discover(): Promise<DiscoverySignal[]> {
    const batches = await Promise.all(
      this.providers.map((p) => p.discover().catch(() => [] as DiscoverySignal[])),
    );
    const strongestByMint = new Map<string, DiscoverySignal>();
    for (const sig of batches.flat()) {
      const existing = strongestByMint.get(sig.mint);
      if (!existing || sig.strength > existing.strength) strongestByMint.set(sig.mint, sig);
    }
    return [...strongestByMint.values()].sort((a, b) => b.strength - a.strength);
  }

  async getSnapshot(mint: Mint): Promise<MarketSnapshot | null> {
    for (const p of this.providers) {
      const snap = await p.getSnapshot(mint).catch(() => null);
      if (snap) return snap;
    }
    return null;
  }

  async getSecurity(mint: Mint): Promise<TokenSecurity | null> {
    for (const p of this.providers) {
      const sec = await p.getSecurity(mint).catch(() => null);
      if (sec) return sec;
    }
    return null;
  }
}
