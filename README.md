# Oracle — AI-Resolved Prediction Market on GenLayer

> Polymarket resolves markets with humans and lawyers.
> Oracle resolves them with on-chain AI in minutes.

Built for the GenLayer Bradbury Builders Hackathon.

## The Problem with Polymarket

Polymarket uses human resolvers + UMA dispute system.
- Resolutions take days
- Human bias exists
- Disputes cost money
- Wrong resolutions have happened

## The Oracle Solution

Oracle uses GenLayer Intelligent Contracts to resolve markets autonomously:
- AI fetches live data from real APIs (CoinGecko, OpenFootball, Reuters)
- 5 validators each run the LLM independently
- Consensus reached via eq_principle_prompt_non_comparative
- No humans. No disputes. No delays.

## GenLayer Tech Used

- `gl.get_webpage()` — fetches 3 live sources per resolution
- `gl.exec_prompt()` — AI cross-references all evidence
- `eq_principle_prompt_non_comparative` — 5 validators reach consensus
- On-chain state stores all markets, bets, and outcomes

## Live Data Sources

| Category | Sources |
|---|---|
| Crypto | CoinGecko API + CoinDesk BPI |
| Sports | OpenFootball Premier League + Champions League |
| Politics | Reuters + AP News |
| Weather | wttr.in JSON API |
| Entertainment | BBC Entertainment + Variety |

## Project Structure
```
oracle/
├── contracts/
│   └── oracle.py           # GenLayer Intelligent Contract
├── deploy/
│   └── deployScript.ts     # CLI deploy script
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx        # Full prediction market UI
│   │   └── layout.tsx
│   ├── package.json
│   ├── next.config.js
│   └── .env.example
└── README.md
```

## Deploy Contract
```bash
npm install -g genlayer
genlayer network
genlayer deploy
```

## Run Frontend
```bash
cd frontend
cp .env.example .env
# Add your contract address to .env
npm install
npm run dev
```

## Deploy to Vercel
```bash
cd frontend
npx vercel --prod
```

Add these env vars in Vercel dashboard:
- `NEXT_PUBLIC_GENLAYER_RPC_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`

## How It Works

1. Browse markets across 5 categories
2. Place YES or NO bets with testnet tokens
3. Create your own market with any question
4. Click Resolve — AI fetches live data and decides
5. Winners split the losing pool automatically
```

---

Commit it.

---

**All 8 files done! 🎉**

Your repo should now look like this:
```
oracle-prediction-market/
├── contracts/
│   └── oracle.py
├── deploy/
│   └── deployScript.ts
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── package.json
│   ├── next.config.js
│   └── .env.example
└── README.md
