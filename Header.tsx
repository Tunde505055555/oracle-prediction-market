import { Link } from "@tanstack/react-router";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

export function Header() {
  const { address, connect, disconnect, connecting } = useWallet();
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary shadow-glow" />
          <span className="font-display text-lg font-bold tracking-tight">
            Oracle<span className="text-gradient">Markets</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground text-sm font-medium" }}
            activeOptions={{ exact: true }}
          >
            Markets
          </Link>
          <Link
            to="/create"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground text-sm font-medium" }}
          >
            Create
          </Link>
          <a
            href="https://explorer-studio.genlayer.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Explorer
          </a>
        </nav>
        <div>
          {address ? (
            <Button variant="secondary" onClick={disconnect} className="font-mono text-xs">
              <Wallet className="mr-2 h-4 w-4" />
              {short}
            </Button>
          ) : (
            <Button onClick={connect} disabled={connecting} className="bg-gradient-primary shadow-glow">
              <Wallet className="mr-2 h-4 w-4" />
              {connecting ? "Connecting…" : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
