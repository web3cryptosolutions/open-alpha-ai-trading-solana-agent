import type {
  MarketSnapshot,
  RiskCheckId,
  RiskCheckResult,
  TokenSecurity,
} from "@openalpha/types";

/**
 * A check is a pure function of (security, market) -> result. Each one is
 * independent and weighted; the engine composes them. Adding a new check is a
 * one-function change — register it in `ALL_CHECKS` and it votes.
 */
export type RiskCheck = (sec: TokenSecurity, market: MarketSnapshot) => RiskCheckResult;

const r = (
  id: RiskCheckId,
  label: string,
  weight: number,
  verdict: RiskCheckResult["verdict"],
  severity: number | null,
  detail: string,
): RiskCheckResult => ({ id, label, weight, verdict, severity, detail });

export const checkMintAuthority: RiskCheck = (sec) =>
  sec.mintAuthority === null
    ? r("mint-authority", "Mint authority", 1.5, "pass", 0, "Mint authority revoked — supply cannot be inflated.")
    : r("mint-authority", "Mint authority", 1.5, "fail", 1, "Mint authority is LIVE — dev can mint unlimited supply.");

export const checkFreezeAuthority: RiskCheck = (sec) =>
  sec.freezeAuthority === null
    ? r("freeze-authority", "Freeze authority", 1.3, "pass", 0, "Freeze authority revoked — your tokens can't be frozen.")
    : r("freeze-authority", "Freeze authority", 1.3, "fail", 1, "Freeze authority is LIVE — dev can freeze your wallet.");

export const checkLiquidityAmount: RiskCheck = (_sec, m) => {
  const liq = m.liquidityUsd;
  if (liq >= 50_000) return r("liquidity-amount", "Liquidity depth", 1.0, "pass", 0, `$${k(liq)} liquidity — exits should fill cleanly.`);
  if (liq >= 10_000) return r("liquidity-amount", "Liquidity depth", 1.0, "warn", 0.5, `$${k(liq)} liquidity — moderate; expect slippage on size.`);
  return r("liquidity-amount", "Liquidity depth", 1.0, "fail", 1, `$${k(liq)} liquidity — thin; you may not be able to exit.`);
};

export const checkLiquidityLocked: RiskCheck = (sec) => {
  if (sec.lpLocked === null) return r("liquidity-locked", "LP locked", 1.2, "unknown", null, "Could not determine if LP is locked/burned.");
  return sec.lpLocked
    ? r("liquidity-locked", "LP locked", 1.2, "pass", 0, "LP is locked or burned — dev can't pull liquidity.")
    : r("liquidity-locked", "LP locked", 1.2, "fail", 1, "LP is NOT locked — dev can rug the pool at any time.");
};

export const checkLpConcentration: RiskCheck = (sec) => {
  const c = sec.lpConcentration;
  if (c === null) return r("lp-concentration", "LP concentration", 0.8, "unknown", null, "LP holder distribution unknown.");
  if (c <= 0.5) return r("lp-concentration", "LP concentration", 0.8, "pass", c, `Top LP holder controls ${pct(c)} of LP.`);
  if (c <= 0.8) return r("lp-concentration", "LP concentration", 0.8, "warn", c, `Top LP holder controls ${pct(c)} of LP — concentrated.`);
  return r("lp-concentration", "LP concentration", 0.8, "fail", c, `Top LP holder controls ${pct(c)} of LP — single point of failure.`);
};

export const checkHolderConcentration: RiskCheck = (sec) => {
  const c = sec.top10HolderPct;
  if (c === null) return r("holder-concentration", "Holder concentration", 1.0, "unknown", null, "Top-holder distribution unknown.");
  if (c <= 0.3) return r("holder-concentration", "Holder concentration", 1.0, "pass", c, `Top 10 hold ${pct(c)} — reasonably distributed.`);
  if (c <= 0.5) return r("holder-concentration", "Holder concentration", 1.0, "warn", c, `Top 10 hold ${pct(c)} — watch for coordinated dumps.`);
  return r("holder-concentration", "Holder concentration", 1.0, "fail", c, `Top 10 hold ${pct(c)} — a few wallets can crater the price.`);
};

export const checkDevHoldings: RiskCheck = (sec) => {
  const d = sec.devHoldingPct;
  if (d === null) return r("dev-holdings", "Dev holdings", 0.9, "unknown", null, "Dev wallet holdings unknown.");
  if (d <= 0.05) return r("dev-holdings", "Dev holdings", 0.9, "pass", d, `Dev holds ${pct(d)} — low dump risk.`);
  if (d <= 0.15) return r("dev-holdings", "Dev holdings", 0.9, "warn", d, `Dev holds ${pct(d)} — meaningful overhang.`);
  return r("dev-holdings", "Dev holdings", 0.9, "fail", d, `Dev holds ${pct(d)} — large dump risk.`);
};

export const checkBundledWallets: RiskCheck = (sec) => {
  const b = sec.bundledWallets;
  if (b === null) return r("bundled-wallets", "Bundled wallets", 0.8, "unknown", null, "Bundle analysis unavailable.");
  if (b <= 3) return r("bundled-wallets", "Bundled wallets", 0.8, "pass", b / 30, `${b} bundled wallets at launch — minimal.`);
  if (b <= 10) return r("bundled-wallets", "Bundled wallets", 0.8, "warn", b / 30, `${b} bundled wallets — coordinated launch.`);
  return r("bundled-wallets", "Bundled wallets", 0.8, "fail", Math.min(1, b / 30), `${b} bundled wallets — heavily sniped/coordinated.`);
};

export const checkWalletClustering: RiskCheck = (sec) => {
  const c = sec.walletClusters;
  if (c === null) return r("wallet-clustering", "Wallet clustering", 0.7, "unknown", null, "Funding-source clustering unavailable.");
  if (c <= 1) return r("wallet-clustering", "Wallet clustering", 0.7, "pass", c / 8, "No significant same-source holder clusters.");
  if (c <= 3) return r("wallet-clustering", "Wallet clustering", 0.7, "warn", c / 8, `${c} same-source clusters among top holders.`);
  return r("wallet-clustering", "Wallet clustering", 0.7, "fail", Math.min(1, c / 8), `${c} same-source clusters — likely one entity in disguise.`);
};

export const checkRugHistory: RiskCheck = (sec) => {
  const n = sec.deployerRugCount;
  if (n === null) return r("rug-history", "Deployer history", 1.4, "unknown", null, "Deployer history unavailable.");
  if (n === 0) return r("rug-history", "Deployer history", 1.4, "pass", 0, "Deployer has no known prior rugs.");
  return r("rug-history", "Deployer history", 1.4, "fail", Math.min(1, n / 3), `Deployer linked to ${n} prior rug(s).`);
};

export const checkTokenAge: RiskCheck = (sec) => {
  const a = sec.tokenAgeMinutes;
  if (a === null) return r("token-age", "Token age", 0.5, "unknown", null, "Token age unknown.");
  if (a >= 1440) return r("token-age", "Token age", 0.5, "pass", 0, `${hrs(a)} old — survived early rug window.`);
  if (a >= 60) return r("token-age", "Token age", 0.5, "warn", 0.4, `${hrs(a)} old — still early.`);
  return r("token-age", "Token age", 0.5, "warn", 0.7, `${Math.round(a)}m old — extremely fresh, max volatility.`);
};

export const checkLiquidityAge: RiskCheck = (sec) => {
  const a = sec.liquidityAgeMinutes;
  if (a === null) return r("liquidity-age", "Liquidity age", 0.5, "unknown", null, "Liquidity age unknown.");
  if (a >= 720) return r("liquidity-age", "Liquidity age", 0.5, "pass", 0, `Liquidity ${hrs(a)} old.`);
  return r("liquidity-age", "Liquidity age", 0.5, "warn", 0.5, `Liquidity only ${Math.round(a)}m old.`);
};

/** Registry of every check. Order here is the order shown in reports. */
export const ALL_CHECKS: readonly RiskCheck[] = [
  checkMintAuthority,
  checkFreezeAuthority,
  checkLiquidityAmount,
  checkLiquidityLocked,
  checkLpConcentration,
  checkHolderConcentration,
  checkDevHoldings,
  checkBundledWallets,
  checkWalletClustering,
  checkRugHistory,
  checkTokenAge,
  checkLiquidityAge,
];

// ── formatting helpers ──────────────────────────────────────────────────────
const pct = (x: number): string => `${(x * 100).toFixed(0)}%`;
const k = (x: number): string => (x >= 1000 ? `${(x / 1000).toFixed(0)}k` : x.toFixed(0));
const hrs = (mins: number): string => (mins >= 60 ? `${(mins / 60).toFixed(0)}h` : `${Math.round(mins)}m`);
