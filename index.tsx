import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { MarketCard } from "@/components/MarketCard";
import { ExternalMarketsSection } from "@/components/ExternalMarketsSection";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Plus, Search, Loader2, ExternalLink } from "lucide-react";
import {
  fetchAllMarkets,
  createMarketTx,
  guessCategory,
  SEED_TEMPLATES,
  type OnChainMarket,
  type SeedTemplate,
} from "@/lib/markets";
import { useWallet } from "@/hooks/useWallet";
import { explorerTx } from "@/lib/genlayer";
import { getMarketStatus } from "@/lib/marketStatus";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "OracleMarkets — Bet on real-world outcomes on GenLayer" },
      {
        name: "description",
        content:
          "Polymarket-style prediction markets settled by GenLayer's intelligent contracts. Crypto, politics, sports, tech.",
      },
    ],
  }),
});

const CATEGORIES = ["All", "Crypto", "Politics", "Sports", "Tech", "Culture", "World"] as const;

function Index() {
  const { address: wallet, connect } = useWallet();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<OnChainMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  // custom create form
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const [o1, setO1] = useState("Yes");
  const [o2, setO2] = useState("No");
  const [url, setUrl] = useState("");
  const [closes, setCloses] = useState("");

  const refresh = useCallback(async () => {
    try {
      const list = await fetchAllMarkets();
      setMarkets(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load markets", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return markets.filter((m) => {
      if (category !== "All" && guessCategory(m.question) !== category) return false;
      if (query && !m.question.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [markets, category, query]);

  const liveCount = markets.filter((m) => getMarketStatus(m) === "live").length;

  const handleCreateSeed = async (s: SeedTemplate) => {
    if (!wallet) return connect();
    setCreating(s.question);
    try {
      const hash = await createMarketTx(wallet, {
        question: s.question,
        option1: s.option1,
        option2: s.option2,
        resolution_url: s.resolution_url,
        closes_at: s.closes_at,
      });
      toast.success("Market created", {
        action: { label: "View tx", onClick: () => window.open(explorerTx(hash), "_blank") },
      });
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Create failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(null);
    }
  };

  const handleCreateCustom = async () => {
    if (!wallet) return connect();
    if (!q || !o1 || !o2 || !url) {
      toast.error("Fill in question, both options and a resolution URL");
      return;
    }
    if (!closes) {
      toast.error("Pick an end date for the market");
      return;
    }
    const closesAt = Math.floor(new Date(closes).getTime() / 1000);
    if (!Number.isFinite(closesAt) || closesAt <= Math.floor(Date.now() / 1000)) {
      toast.error("End date must be in the future");
      return;
    }
    setCreating(q);
    try {
      const hash = await createMarketTx(wallet, {
        question: q,
        option1: o1,
        option2: o2,
        resolution_url: url,
        closes_at: closesAt,
      });
      toast.success("Market created", {
        action: { label: "View tx", onClick: () => window.open(explorerTx(hash), "_blank") },
      });
      setQ("");
      setUrl("");
      setCloses("");
      setShowForm(false);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Create failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(null);
    }
  };

  // Seed templates not yet on-chain (avoid duplicating by question text)
  const existingQuestions = new Set(markets.map((m) => m.question.toLowerCase()));
  const availableSeeds = SEED_TEMPLATES.filter(
    (s) => !existingQuestions.has(s.question.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      <Header />

      <section className="container mx-auto max-w-6xl px-4 pb-6 pt-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Powered by GenLayer Intelligent Contracts · Gas-less on Studio
        </div>
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Bet on what's <span className="text-gradient">true</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          One hub contract holds every market. Real escrow, AI validators read the live web,
          winners claim their share of the pool on-chain.
        </p>
      </section>

      <main className="container mx-auto max-w-6xl px-4 pb-16">
        {/* Create market */}
        <Card className="mb-8 border-border/60 bg-card/60 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Create a new market</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowForm((s) => !s)}
              className="border border-border/60"
            >
              {showForm ? "Hide form" : "Custom market"}
            </Button>
          </div>

          {showForm && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Question (e.g. Will X happen by Y?)"
                className="md:col-span-2"
              />
              <Input value={o1} onChange={(e) => setO1(e.target.value)} placeholder="Option 1" />
              <Input value={o2} onChange={(e) => setO2(e.target.value)} placeholder="Option 2" />
              <div className="md:col-span-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Resolution URL the AI oracle will read"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Pick a bot-friendly page (Wikipedia, official press release, public API, news
                  article). Avoid CoinGecko, CoinMarketCap, X/Twitter and other Cloudflare-protected
                  sites — validators will get a 403 and resolution will fail.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Market end date & time
                </label>
                <Input
                  type="datetime-local"
                  value={closes}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={(e) => setCloses(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Betting closes at this time. Resolution can run after.
                </p>
              </div>
              <Button
                onClick={handleCreateCustom}
                disabled={!!creating}
                className="bg-gradient-primary"
              >
                {creating === q ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Deploy market
              </Button>
            </div>
          )}

          {availableSeeds.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                One-click templates
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSeeds.slice(0, 6).map((s) => (
                  <Button
                    key={s.question}
                    size="sm"
                    variant="secondary"
                    disabled={!!creating}
                    onClick={() => handleCreateSeed(s)}
                    className="border border-border/60 text-xs"
                  >
                    {creating === s.question ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    {s.question}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <ExternalMarketsSection />

        {/* Search + categories */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search markets…"
              className="bg-card/60 pl-9 backdrop-blur-md"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="bg-success/15 text-success">
              {liveCount} live
            </Badge>
            <span>{markets.length} total</span>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                category === c
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            {markets.length === 0
              ? "No markets yet — create the first one above."
              : "No markets match your filters."}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        Built on GenLayer Studio · Chain ID 61999 ·{" "}
        <a
          href="https://explorer-studio.genlayer.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          Explorer <ExternalLink className="h-3 w-3" />
        </a>
      </footer>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
