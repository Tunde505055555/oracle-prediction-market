import { useEffect, useState, useCallback } from "react";
import { explorerTx, EXPLORER_URL } from "@/lib/genlayer";
import { HUB_ADDRESS } from "@/lib/config";
import {
  fetchMarket,
  fetchUserBets,
  placeBetTx,
  resolveTx,
  claimTx,
  type OnChainMarket,
  type UserBets,
} from "@/lib/markets";
import { getMarketStatus, statusLabel } from "@/lib/marketStatus";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ExternalLink, Loader2, TrendingUp } from "lucide-react";

function fmtWei(wei: string) {
  try {
    const eth = Number(BigInt(wei)) / 1e18;
    return eth.toLocaleString(undefined, { maximumFractionDigits: 6 });
  } catch {
    return "0";
  }
}

export function MarketView({ marketId }: { marketId: number }) {
  const { address: wallet, connect } = useWallet();
  const [state, setState] = useState<OnChainMarket | null>(null);
  const [userBets, setUserBets] = useState<UserBets | null>(null);
  const [loading, setLoading] = useState(true);
  const [betting, setBetting] = useState<1 | 2 | null>(null);
  const [resolving, setResolving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(i);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await fetchMarket(marketId);
      setState(s);
      if (wallet) setUserBets(await fetchUserBets(marketId, wallet));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load market", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [marketId, wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const placeBet = async (option: 1 | 2) => {
    if (!wallet) return connect();
    const amount = option === 1 ? amount1 : amount2;
    const eth = parseFloat(amount);
    if (!eth || eth <= 0) {
      toast.error("Enter a bet amount");
      return;
    }
    setBetting(option);
    try {
      const value = BigInt(Math.floor(eth * 1e18));
      const hash = await placeBetTx(wallet, marketId, option, value);
      toast.success("Bet accepted!", {
        action: { label: "View", onClick: () => window.open(explorerTx(hash), "_blank") },
      });
      if (option === 1) setAmount1("");
      else setAmount2("");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Bet failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBetting(null);
    }
  };

  const resolve = async () => {
    if (!wallet) return connect();
    setResolving(true);
    try {
      const hash = await resolveTx(wallet, marketId);
      toast.success("Market resolved!", {
        action: { label: "View", onClick: () => window.open(explorerTx(hash), "_blank") },
      });
      await refresh();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      const blocked =
        /WEBPAGE_LOAD_FAILED|403|bot|cloudflare|verifying you are human|could not be loaded/i.test(
          msg,
        );
      toast.error(
        blocked ? "Oracle could not read the resolution page" : "Resolution failed",
        {
          description: blocked
            ? "The page is blocking bots (e.g. Cloudflare/CoinGecko). Pick a bot-friendly source like Wikipedia, an official press release, or a public API page, then create a new market."
            : msg,
          duration: 12000,
        },
      );
    } finally {
      setResolving(false);
    }
  };

  const claim = async () => {
    if (!wallet) return connect();
    setClaiming(true);
    try {
      const hash = await claimTx(wallet, marketId);
      toast.success("Payout claimed!", {
        action: { label: "View", onClick: () => window.open(explorerTx(hash), "_blank") },
      });
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Claim failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!state) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No market found with id #{marketId}.</p>
      </Card>
    );
  }

  const total1 = BigInt(state.total_option1);
  const total2 = BigInt(state.total_option2);
  const total = total1 + total2;
  const pct1 = total > 0n ? Number((total1 * 10000n) / total) / 100 : 50;
  const pct2 = 100 - pct1;
  const status = getMarketStatus(state, now);
  const canBet = status === "live";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60 bg-card/60 p-8 shadow-card backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Market #{state.id}
          <span
            className={`ml-auto rounded-full px-3 py-1 ${
              status === "resolved"
                ? "bg-success/20 text-success"
                : status === "closed"
                  ? "bg-muted text-muted-foreground"
                  : "bg-accent/15 text-accent"
            }`}
          >
            {statusLabel(status)}
          </span>
        </div>
        {state.closes_at > 0 && (
          <div className="mb-2 text-xs text-muted-foreground">
            {status === "live" ? "Closes" : "Closed"}{" "}
            {new Date(state.closes_at * 1000).toLocaleString()}
          </div>
        )}
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          {state.question}
        </h2>
        <a
          href={state.resolution_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          Resolution source <ExternalLink className="h-3 w-3" />
        </a>
        <div className="mt-4 font-mono text-xs text-muted-foreground">
          Hub:{" "}
          <a
            href={`${EXPLORER_URL}/contracts/${HUB_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            {HUB_ADDRESS}
          </a>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>{pct1.toFixed(1)}% on {state.option1}</span>
            <span>{pct2.toFixed(1)}% on {state.option2}</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${pct1}%` }} />
            <div className="bg-gradient-to-r from-accent/70 to-accent transition-all" style={{ width: `${pct2}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {([1, 2] as const).map((opt) => {
          const label = opt === 1 ? state.option1 : state.option2;
          const totalSide = opt === 1 ? state.total_option1 : state.total_option2;
          const userBet = userBets ? (opt === 1 ? userBets.option1 : userBets.option2) : "0";
          const winner = state.winner === opt;
          const isLoser = state.has_resolved && state.winner !== opt && state.winner !== 0;
          return (
            <Card
              key={opt}
              className={`relative overflow-hidden border-border/60 bg-card/60 p-6 backdrop-blur-md transition-all ${
                winner ? "border-success shadow-glow" : isLoser ? "opacity-60" : ""
              }`}
            >
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Option {opt}
              </div>
              <div className="font-display text-2xl font-bold">{label}</div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total pool</span>
                  <span className="font-mono">{fmtWei(totalSide)} GEN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your bet</span>
                  <span className="font-mono">{fmtWei(userBet)} GEN</span>
                </div>
              </div>

              {canBet && (
                <div className="mt-5 flex gap-2">
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.0"
                    value={opt === 1 ? amount1 : amount2}
                    onChange={(e) =>
                      opt === 1 ? setAmount1(e.target.value) : setAmount2(e.target.value)
                    }
                    className="bg-background/50 font-mono"
                  />
                  <Button
                    onClick={() => placeBet(opt)}
                    disabled={betting !== null}
                    className="bg-gradient-primary"
                  >
                    {betting === opt ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bet"}
                  </Button>
                </div>
              )}
              {status === "closed" && (
                <div className="mt-5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Betting closed — awaiting oracle resolution.
                </div>
              )}
              {winner && (
                <div className="mt-4 rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
                  ✓ Winning outcome
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {status !== "resolved" && (
        <Card className="border-border/60 bg-card/60 p-6 backdrop-blur-md">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="font-display text-lg font-semibold">Resolve this market</div>
              <p className="mt-1 text-sm text-muted-foreground">
                GenLayer validators will fetch the resolution URL and reach consensus on the
                winning outcome.
              </p>
            </div>
            <Button
              onClick={resolve}
              disabled={resolving}
              variant="secondary"
              size="lg"
              className="border border-accent/40 hover:bg-accent/10"
            >
              {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {resolving ? "Resolving…" : "Resolve via Oracle"}
            </Button>
          </div>
        </Card>
      )}

      {state.has_resolved && userBets && BigInt(userBets.payout) > 0n && (
        <Card className="border-success/40 bg-card/60 p-6 backdrop-blur-md">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="font-display text-lg font-semibold">
                {userBets.claimed ? "Payout claimed" : "Claim your payout"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {userBets.claimed
                  ? "These funds have already been transferred to your wallet."
                  : `You are entitled to ${fmtWei(userBets.payout)} GEN from the pool.`}
              </p>
            </div>
            <Button
              onClick={claim}
              disabled={claiming || userBets.claimed}
              size="lg"
              className="bg-gradient-primary shadow-glow"
            >
              {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {userBets.claimed
                ? "Claimed"
                : claiming
                  ? "Claiming…"
                  : `Claim ${fmtWei(userBets.payout)} GEN`}
            </Button>
          </div>
        </Card>
      )}

      {state.has_resolved && state.resolution_notes && (
        <Card className="border-border/60 bg-card/60 p-6 backdrop-blur-md">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Oracle notes
          </div>
          <p className="mt-2 text-sm">{state.resolution_notes}</p>
        </Card>
      )}
    </div>
  );
}
