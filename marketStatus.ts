import type { OnChainMarket } from "./markets";

export type MarketStatus = "live" | "closed" | "resolved";

/**
 * Derive market status from on-chain truth + current time.
 * Never trust cached/static metadata — recompute on every render.
 */
export function getMarketStatus(m: OnChainMarket, now: number = Date.now()): MarketStatus {
  if (m.has_resolved) return "resolved";
  if (m.closes_at > 0 && now >= m.closes_at * 1000) return "closed";
  return "live";
}

export function statusLabel(s: MarketStatus): string {
  return s === "resolved" ? "Resolved" : s === "closed" ? "Closed" : "Live";
}
