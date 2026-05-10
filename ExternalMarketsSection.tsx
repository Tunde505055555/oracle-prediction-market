import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Globe2 } from "lucide-react";
import { fetchExternalMarkets, type ExternalMarket } from "@/lib/externalMarkets";

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function ExternalMarketsSection() {
  const [markets, setMarkets] = useState<ExternalMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExternalMarkets()
      .then((m) => {
        if (!cancelled) setMarkets(m);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || markets.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5" />
            Trending elsewhere
          </div>
          <h2 className="font-display text-xl font-semibold">
            Latest active markets across the web
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          via Polymarket · for discovery only
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((m) => {
          const yesPct = Math.round(m.yesPrice * 100);
          return (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="group block"
            >
              <Card className="h-full border-border/40 bg-card/40 p-4 backdrop-blur-md transition-all hover:border-accent/40 hover:bg-card/70">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="secondary" className="bg-muted/40 text-[10px]">
                    {m.category}
                  </Badge>
                  <ExternalLink className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-accent" />
                </div>
                <h3 className="line-clamp-3 min-h-[3.6rem] text-sm font-medium leading-snug">
                  {m.question}
                </h3>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono text-primary">Yes {yesPct}%</span>
                  <span>Vol {fmtUsd(m.volumeUsd)}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${yesPct}%` }}
                  />
                </div>
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
