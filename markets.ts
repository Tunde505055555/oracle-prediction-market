import { getReadClient, getWriteClient } from "./genlayer";
import { HUB_ADDRESS } from "./config";
import { TransactionStatus } from "genlayer-js/types";

export type MarketCategory =
  | "Politics"
  | "Crypto"
  | "Sports"
  | "Tech"
  | "Culture"
  | "World";

export type OnChainMarket = {
  id: number;
  question: string;
  option1: string;
  option2: string;
  resolution_url: string;
  has_resolved: boolean;
  winner: number;
  resolution_notes: string;
  total_option1: string;
  total_option2: string;
  creator: string;
  closes_at: number;
};

export type UserBets = {
  option1: string;
  option2: string;
  claimed: boolean;
  payout: string;
};

/** Curated seed templates users can deploy with one click. */
export type SeedTemplate = {
  category: MarketCategory;
  question: string;
  option1: string;
  option2: string;
  resolution_url: string;
  closes_at: number;
};

// Unix timestamps for common close dates (all in the future as of May 2026)
const END_OF_2026 = 1798761540; // 2026-12-31 23:59 UTC
const MID_2026 = 1782950400;    // 2026-06-30 12:00 UTC
const WORLD_CUP_FINAL = 1784073600; // 2026-07-19 (FIFA WC final day)

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    category: "Sports",
    question: "Will Argentina win the 2026 FIFA World Cup?",
    option1: "Yes",
    option2: "No",
    resolution_url:
      "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_final",
    closes_at: WORLD_CUP_FINAL,
  },
  {
    category: "Sports",
    question: "Will the host nation (USA, Canada or Mexico) reach the 2026 World Cup semifinals?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage",
    closes_at: WORLD_CUP_FINAL,
  },
  {
    category: "Tech",
    question: "Will OpenAI release GPT-6 (or named successor) before 2027?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/GPT-5",
    closes_at: END_OF_2026,
  },
  {
    category: "Tech",
    question: "Will Apple announce a foldable iPhone in 2026?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/IPhone",
    closes_at: END_OF_2026,
  },
  {
    category: "Tech",
    question: "Will SpaceX successfully launch an uncrewed Starship toward Mars in 2026?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/SpaceX_Starship",
    closes_at: END_OF_2026,
  },
  {
    category: "Crypto",
    question: "Will GenLayer publicly launch a transferable token before Dec 31, 2026?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/GenLayer",
    closes_at: END_OF_2026,
  },
  {
    category: "Culture",
    question: "Will Taylor Swift release a new studio album in 2026?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/Taylor_Swift_albums_discography",
    closes_at: END_OF_2026,
  },
  {
    category: "Culture",
    question: "Will Avatar: Fire and Ash gross over $2B worldwide?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/Avatar:_Fire_and_Ash",
    closes_at: END_OF_2026,
  },
  {
    category: "World",
    question: "Will the US officially enter a recession in 2026 (per NBER)?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/List_of_recessions_in_the_United_States",
    closes_at: END_OF_2026,
  },
  {
    category: "Politics",
    question: "Will the UK have a new Prime Minister by end of 2026?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/Prime_Minister_of_the_United_Kingdom",
    closes_at: END_OF_2026,
  },
  {
    category: "Politics",
    question: "Will Democrats win the US House majority in the 2026 midterms?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_elections",
    closes_at: 1762128000, // ~Nov 3 2026
  },
  {
    category: "Tech",
    question: "Will Nvidia's market cap exceed $5T at any close in 2026?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/Nvidia",
    closes_at: END_OF_2026,
  },
  {
    category: "World",
    question: "Will a ceasefire in Ukraine be officially signed in 2026?",
    option1: "Yes",
    option2: "No",
    resolution_url: "https://en.wikipedia.org/wiki/Russo-Ukrainian_War_peace_negotiations",
    closes_at: END_OF_2026,
  },
];

/** Best-effort category guess from a question string for fully on-chain markets. */
export function guessCategory(question: string): MarketCategory {
  const q = question.toLowerCase();
  if (/(bitcoin|btc|ethereum|eth|solana|sol|crypto|token|coin)/.test(q)) return "Crypto";
  if (/(election|president|prime minister|senate|congress|vote|party)/.test(q)) return "Politics";
  if (/(world cup|nba|nfl|premier league|champions league|olympic|fifa|uefa|match|game)/.test(q))
    return "Sports";
  if (/(ai|gpt|openai|apple|google|microsoft|nvidia|spacex|launch|chip|iphone)/.test(q))
    return "Tech";
  if (/(album|movie|oscar|grammy|netflix|swift|beyonc)/.test(q)) return "Culture";
  return "World";
}

function parseMaybeJson<T>(v: unknown): T {
  if (typeof v === "string") return JSON.parse(v) as T;
  return v as T;
}

export async function fetchAllMarkets(): Promise<OnChainMarket[]> {
  const client = getReadClient();
  const raw = await client.readContract({
    address: HUB_ADDRESS,
    functionName: "get_markets",
    args: [],
  });
  const list = parseMaybeJson<OnChainMarket[]>(raw);
  return Array.isArray(list) ? list : [];
}

export async function fetchMarket(id: number): Promise<OnChainMarket> {
  const client = getReadClient();
  const raw = await client.readContract({
    address: HUB_ADDRESS,
    functionName: "get_market",
    args: [id],
  });
  return parseMaybeJson<OnChainMarket>(raw);
}

export async function fetchUserBets(id: number, user: string): Promise<UserBets> {
  const client = getReadClient();
  const raw = await client.readContract({
    address: HUB_ADDRESS,
    functionName: "get_user_bets",
    args: [id, user],
  });
  return parseMaybeJson<UserBets>(raw);
}

async function ensureChain(client: ReturnType<typeof getWriteClient>) {
  try {
    await client.connect("studionet");
  } catch {
    /* already on chain */
  }
}

export async function createMarketTx(
  wallet: `0x${string}`,
  args: {
    question: string;
    option1: string;
    option2: string;
    resolution_url: string;
    closes_at: number;
  },
) {
  const client = getWriteClient(wallet);
  await ensureChain(client);
  const hash = await client.writeContract({
    address: HUB_ADDRESS,
    functionName: "create_market",
    args: [
      args.question,
      args.option1,
      args.option2,
      args.resolution_url,
      args.closes_at,
    ],
    value: BigInt(0),
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  return hash;
}

export async function placeBetTx(
  wallet: `0x${string}`,
  marketId: number,
  option: 1 | 2,
  weiValue: bigint,
) {
  const client = getWriteClient(wallet);
  await ensureChain(client);
  const hash = await client.writeContract({
    address: HUB_ADDRESS,
    functionName: "place_bet",
    args: [marketId, option],
    value: weiValue,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  return hash;
}

export async function resolveTx(wallet: `0x${string}`, marketId: number) {
  const client = getWriteClient(wallet);
  await ensureChain(client);
  const hash = await client.writeContract({
    address: HUB_ADDRESS,
    functionName: "resolve",
    args: [marketId],
    value: BigInt(0),
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  return hash;
}

export async function claimTx(wallet: `0x${string}`, marketId: number) {
  const client = getWriteClient(wallet);
  await ensureChain(client);
  const hash = await client.writeContract({
    address: HUB_ADDRESS,
    functionName: "claim",
    args: [marketId],
    value: BigInt(0),
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  return hash;
}
