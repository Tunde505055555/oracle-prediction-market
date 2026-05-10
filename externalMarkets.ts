/**
 * External prediction market data (Polymarket Gamma public API).
 * Used purely as a discovery / trending feed — GenLayer remains the
 * on-chain source of truth for any market our app actually settles.
 */

export type ExternalMarket = {
  id: string;
  question: string;
  category: string;
  url: string;
  volumeUsd: number;
  liquidityUsd: number;
  endDate: number; // unix seconds, 0 if unknown
  yesPrice: number; // 0..1
  image?: string;
};

type GammaMarket = {
  id: string | number;
  question: string;
  slug?: string;
  category?: string;
  volume?: string | number;
  volumeNum?: number;
  liquidity?: string | number;
  liquidityNum?: number;
  endDate?: string;
  outcomePrices?: string; // JSON-encoded array like "[\"0.62\",\"0.38\"]"
  active?: boolean;
  closed?: boolean;
  image?: string;
};

const GAMMA_URL =
  "https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=24&order=volume24hr&ascending=false";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function fetchExternalMarkets(): Promise<ExternalMarket[]> {
  const res = await fetch(GAMMA_URL);
  if (!res.ok) throw new Error(`Polymarket: ${res.status}`);
  const raw = (await res.json()) as GammaMarket[];
  if (!Array.isArray(raw)) return [];

  const now = Date.now();
  return raw
    .filter((m) => m && m.question && !m.closed && m.active !== false)
    .map((m): ExternalMarket => {
      let yes = 0.5;
      if (m.outcomePrices) {
        try {
          const arr = JSON.parse(m.outcomePrices) as string[];
          if (Array.isArray(arr) && arr.length > 0) yes = num(arr[0]);
        } catch {
          /* ignore */
        }
      }
      const end = m.endDate ? Math.floor(new Date(m.endDate).getTime() / 1000) : 0;
      return {
        id: String(m.id),
        question: m.question,
        category: m.category || "Trending",
        url: m.slug
          ? `https://polymarket.com/event/${m.slug}`
          : "https://polymarket.com",
        volumeUsd: m.volumeNum ?? num(m.volume),
        liquidityUsd: m.liquidityNum ?? num(m.liquidity),
        endDate: end,
        yesPrice: yes,
        image: m.image,
      };
    })
    .filter((m) => m.endDate === 0 || m.endDate * 1000 > now)
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, 12);
}
