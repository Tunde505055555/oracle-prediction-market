import { createFileRoute, useParams } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MarketView } from "@/components/MarketView";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/market/$id")({
  component: MarketPage,
  head: ({ params }) => ({
    meta: [
      { title: `Market #${params.id} — OracleMarkets` },
      { name: "description", content: "View, bet, and resolve a GenLayer prediction market." },
    ],
  }),
});

function MarketPage() {
  const { id } = useParams({ from: "/market/$id" });
  const marketId = Number(id);
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-12">
        {Number.isFinite(marketId) ? (
          <MarketView marketId={marketId} />
        ) : (
          <p className="text-center text-muted-foreground">Invalid market id.</p>
        )}
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
