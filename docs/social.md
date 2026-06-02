# Social intelligence

`@openalpha/social-intelligence` ships the `SocialIntelligence` interface and a stub. Implement it to turn X / Telegram / Discord chatter into a discovery source and an extra evidence channel.

```ts
interface SocialIntelligence {
  id: string;
  snapshot(mint: Mint): Promise<SocialSnapshot | null>;  // mentions, velocity, sentiment
  discover(): Promise<DiscoverySignal[]>;                 // source: "trending"
}
```

## Recipe

1. Ingest mentions from your data vendor (X API, Telegram channels, Discord servers).
2. Compute a `SocialSnapshot`: `mentions1h`, `mentionVelocity` (vs prior window), `sentiment` (-1..1), `influencerHits`.
3. Emit `DiscoverySignal`s with `source: "trending"` when velocity spikes.
4. Optionally surface the snapshot to the decision engine as additional context.

Keep sentiment models swappable — a lexicon baseline is fine before you reach for an LLM classifier.
