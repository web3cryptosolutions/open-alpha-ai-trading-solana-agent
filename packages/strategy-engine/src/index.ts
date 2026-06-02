export { StrategyRegistry } from "./registry.ts";
export { momentumStrategy } from "./strategies/momentum.ts";
export type { MomentumOptions } from "./strategies/momentum.ts";
export { meanReversionStrategy } from "./strategies/mean-reversion.ts";
export type { MeanReversionOptions } from "./strategies/mean-reversion.ts";

import { momentumStrategy } from "./strategies/momentum.ts";
import { meanReversionStrategy } from "./strategies/mean-reversion.ts";
import { StrategyRegistry } from "./registry.ts";

/** A registry pre-loaded with the built-in reference strategies. */
export function defaultRegistry(): StrategyRegistry {
  return new StrategyRegistry().register(momentumStrategy()).register(meanReversionStrategy());
}
