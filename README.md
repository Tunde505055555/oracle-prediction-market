# OracleMarkets — GenLayer Prediction Hub

A Polymarket-style prediction market dApp where every market is settled by **GenLayer Intelligent Contracts** (AI validators that read the live web and reach consensus on real-world outcomes).

## How it was built
- **Frontend:** React 19 + TanStack Start (SSR + file-based routing) + Vite 7 + Tailwind v4 + shadcn/ui.
- **Wallet:** Browser EIP-1193 provider via `genlayer-js` on the GenLayer Studio testnet (chain 61999, gas-less).
- **Smart contract:** A single Python intelligent contract (`contracts/PredictionMarketHub.py`) that holds **every market** in one hub — handles create, bet, escrow, AI-driven resolution, and claim.
- **AI resolution:** Validators fetch a user-supplied URL (Wikipedia, official press releases, public APIs) and vote on the winning option. Consensus uses `prompt_comparative` on a single-digit winner output to avoid `UNDETERMINED` outcomes from free-form LLM text.
- **Discovery:** A side panel pulls trending Polymarket markets via their public CLOB API for inspiration.

## Features
- Connect wallet, browse all on-chain markets in one grid (search + categories: Crypto, Politics, Sports, Tech, Culture, World).
- **Create custom markets** with a question, two options, a resolution URL, and an end date/time picker.
- **One-click seed templates** — 12+ live 2026 markets (World Cup, GPT-6, Starship, GenLayer TGE, US elections, etc.).
- Place YES/NO bets that lock funds in the hub's on-chain escrow.
- Trigger AI oracle resolution after a market closes; winners claim their pro-rata share of the pool.
- Live status badges (Live / Closed / Resolved) computed from on-chain truth + current time.
- Direct GenLayer Explorer links for every transaction.

## Configuration
- Hub contract address: `src/lib/config.ts` → `HUB_ADDRESS`
- Currently deployed at: `0xe9d7aDf539A522E9a54edcd37ba6ECF6D74c6543`
