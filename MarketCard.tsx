import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OnChainMarket } from "@/lib/markets";
import { guessCategory } from "@/lib/markets";
import { getMarketStatus } from "@/lib/marketStatus";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

function fmtGen(wei: string) {
  try {
    const eth = Number(BigInt(wei)) / 1e18;
    if (eth === 0) return "0";
    return eth.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return "0";
  }
}

export function MarketCard({ market }: { market: OnChainMarket }) {
  const t1 = BigInt(market.total_option1);
  const t2 = BigInt(market.total_option2);
  const total = t1 + t2;
  const pct1 = total > 0n ? Number((t1 * 10000n) / total) / 100 : 50;
  const category = guessCategory(market.question);

  // Re-derive status from on-chain truth + current clock; tick every 30s so
  // a market flips Live → Closed in-place without needing a refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  const status = getMarketStatus(market, now);

  return (
    <Link to="/market/$id" params={{ id: String(market.id) }} className="block h-full">
      <Card className="group relative h-full overflow-hidden border-border/60 bg-card/60 p-5 backdrop-blur-md transition-all hover:border-accent/60 hover:shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <Badge variant="secondary" className="bg-muted/60 text-xs font-medium">
            {category}
          </Badge>
          {status === "resolved" ? (
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-success">
              Resolved
            </span>
          ) : status === "closed" ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Live
            </span>
          )}
        </div>

        <h3 className="line-clamp-3 min-h-[3.6rem] font-display text-base font-semibold leading-snug">
          {market.question}
        </h3>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{market.option1}</span>
            <span className="font-mono text-primary">{pct1.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
              style={{ width: `${pct1}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{market.option2}</span>
            <span className="font-mono text-accent">{(100 - pct1).toFixed(0)}%</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Pool {fmtGen(total.toString())} GEN
          </span>
          {market.closes_at > 0 && (
            <span>
              Closes{" "}
              {new Date(market.closes_at * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
