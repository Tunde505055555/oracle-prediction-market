import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { HUB_ADDRESS } from "@/lib/config";
import { EXPLORER_URL } from "@/lib/genlayer";

export const Route = createFileRoute("/create")({
  component: CreatePage,
  head: () => ({
    meta: [
      { title: "Deploy the Hub — OracleMarkets" },
      {
        name: "description",
        content: "Deploy the PredictionMarketHub intelligent contract on GenLayer Studio.",
      },
    ],
  }),
});

function CreatePage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const res = await fetch("/contracts/PredictionMarketHub.py").catch(() => null);
    const code = res && res.ok ? await res.text() : HUB_NOTE;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Contract code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Deploy the <span className="text-gradient">Market Hub</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          You only need to deploy the hub contract <span className="font-mono">once</span>. After
          that, anyone can create new markets directly from the homepage — no extra deploys.
        </p>

        <Card className="mt-8 border-border/60 bg-card/60 p-5 backdrop-blur-md">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Currently configured hub
          </div>
          <a
            href={`${EXPLORER_URL}/contracts/${HUB_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 break-all font-mono text-sm text-accent hover:underline"
          >
            {HUB_ADDRESS} <ExternalLink className="h-3 w-3" />
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            Edit <span className="font-mono">src/lib/config.ts</span> to point at a different
            deployment.
          </p>
        </Card>

        <div className="mt-8 space-y-6">
          {[
            {
              n: "1",
              title: "Open GenLayer Studio",
              body: (
                <a
                  href="https://studio.genlayer.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  studio.genlayer.com <ExternalLink className="h-3 w-3" />
                </a>
              ),
            },
            {
              n: "2",
              title: "Paste contracts/PredictionMarketHub.py",
              body: (
                <Button
                  onClick={copy}
                  variant="secondary"
                  size="sm"
                  className="border border-border/60"
                >
                  {copied ? (
                    <Check className="mr-2 h-4 w-4 text-success" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy contract"}
                </Button>
              ),
            },
            {
              n: "3",
              title: "Deploy with no constructor args",
              body: (
                <p className="text-sm text-muted-foreground">
                  The hub takes no constructor parameters. Hit Deploy and copy the resulting
                  contract address.
                </p>
              ),
            },
            {
              n: "4",
              title: "Update src/lib/config.ts",
              body: (
                <p className="text-sm text-muted-foreground">
                  Replace <span className="font-mono">HUB_ADDRESS</span> with your new address,
                  then create markets directly from the homepage.
                </p>
              ),
            },
          ].map((s) => (
            <Card
              key={s.n}
              className="flex gap-4 border-border/60 bg-card/60 p-6 backdrop-blur-md"
            >
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-primary font-display text-lg font-bold shadow-glow">
                {s.n}
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <div className="mt-2">{s.body}</div>
              </div>
            </Card>
          ))}
        </div>
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}

const HUB_NOTE = `# See contracts/PredictionMarketHub.py in the project repository.`;
