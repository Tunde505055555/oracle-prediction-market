'use client';

import { useState, useEffect, useCallback } from 'react';

const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com:8443/api';
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

type Market = {
  id: number;
  question: string;
  category: string;
  resolution_url: string;
  resolution_date: string;
  creator: string;
  status: 'open' | 'resolved' | 'cancelled';
  outcome: boolean | null;
  resolution_reason: string;
  total_yes: number;
  total_no: number;
  bets: { bettor: string; side: string; amount: number }[];
};

type Tab = 'markets' | 'create' | 'resolve' | 'portfolio';

async function rpcCall(method: string, args: any[] = []): Promise<any> {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'gen_call',
      params: [{ to: CONTRACT, data: { method, args } }, 'latest'],
      id: Date.now(),
    }),
  });
  const j = await r.json();
  return j?.result;
}

async function rpcWrite(method: string, args: any[], pk: string): Promise<string> {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'gen_sendTransaction',
      params: [{ to: CONTRACT, data: { method, args }, value: '0x0' }, pk],
      id: Date.now(),
    }),
  });
  const j = await r.json();
  return j?.result;
}

async function waitTx(hash: string): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'gen_getTransactionReceipt',
        params: [hash], id: Date.now(),
      }),
    });
    const j = await r.json();
    if (j?.result?.status === 'FINALIZED') return true;
  }
  return false;
}

const CATEGORIES: Record<string, { icon: string; color: string; bg: string }> = {
  crypto:        { icon: '₿', color: '#F7931A', bg: 'rgba(247,147,26,.1)' },
  sports:        { icon: '⚽', color: '#00e5a0', bg: 'rgba(0,229,160,.1)' },
  politics:      { icon: '🏛', color: '#7b61ff', bg: 'rgba(123,97,255,.1)' },
  weather:       { icon: '🌤', color: '#38bdf8', bg: 'rgba(56,189,248,.1)' },
  entertainment: { icon: '🎬', color: '#f43f5e', bg: 'rgba(244,63,94,.1)' },
};

const DEMO_MARKETS: Omit<Market, 'id'>[] = [
  { question: 'Will Bitcoin exceed $100,000 before July 2025?', category: 'crypto', resolution_url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', resolution_date: '2025-07-01', creator: '0xdemo1', status: 'open', outcome: null, resolution_reason: '', total_yes: 8400, total_no: 3200, bets: [] },
  { question: 'Will Nigeria qualify for the 2026 FIFA World Cup?', category: 'sports', resolution_url: 'https://openfootball.github.io/england/2025-26/1-premierleague.json', resolution_date: '2025-11-01', creator: '0xdemo2', status: 'open', outcome: null, resolution_reason: '', total_yes: 5100, total_no: 6700, bets: [] },
  { question: 'Will Ethereum exceed $5,000 before June 2025?', category: 'crypto', resolution_url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', resolution_date: '2025-06-30', creator: '0xdemo3', status: 'open', outcome: null, resolution_reason: '', total_yes: 4200, total_no: 4800, bets: [] },
  { question: 'Will there be a US Federal Reserve rate cut before September 2025?', category: 'politics', resolution_url: 'https://www.reuters.com/markets/us/', resolution_date: '2025-09-01', creator: '0xdemo4', status: 'open', outcome: null, resolution_reason: '', total_yes: 7300, total_no: 2100, bets: [] },
  { question: 'Will Arsenal finish in the top 4 of the Premier League 2024-25?', category: 'sports', resolution_url: 'https://openfootball.github.io/england/2024-25/1-premierleague.json', resolution_date: '2025-05-20', creator: '0xdemo5', status: 'open', outcome: null, resolution_reason: '', total_yes: 6800, total_no: 2200, bets: [] },
  { question: 'Will Solana exceed $300 before May 2025?', category: 'crypto', resolution_url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', resolution_date: '2025-05-01', creator: '0xdemo6', status: 'resolved', outcome: false, resolution_reason: '[HIGH confidence] CoinGecko API shows SOL at $142.30 USD, significantly below the $300 threshold with days remaining until resolution date.', total_yes: 2900, total_no: 6100, bets: [] },
];

function calcOdds(yes: number, no: number) {
  const t = yes + no;
  if (t === 0) return { yes: 50, no: 50 };
  return { yes: Math.round((yes / t) * 100), no: Math.round((no / t) * 100) };
}

function fmtVolume(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function timeLeft(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 30) return Math.floor(days / 30) + 'mo left';
  if (days > 0) return days + 'd left';
  return 'Closing soon';
}

function MarketCard({ market, onBet, onResolve, isDemo }: {
  market: Market & { id: number };
  onBet: (m: Market) => void;
  onResolve: (id: number) => void;
  isDemo: boolean;
}) {
  const cat = CATEGORIES[market.category] || CATEGORIES.crypto;
  const odds = calcOdds(market.total_yes, market.total_no);
  const vol = market.total_yes + market.total_no;

  return (
    <div style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '14px', padding: '20px', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}>
      {market.status !== 'open' && (
        <div style={{ position: 'absolute', top: 12, right: 12, padding: '3px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const, background: market.status === 'resolved' ? (market.outcome ? 'rgba(0,229,160,.15)' : 'rgba(244,63,94,.15)') : 'rgba(100,100,100,.2)', color: market.status === 'resolved' ? (market.outcome ? '#00e5a0' : '#f43f5e') : '#666', border: '1px solid ' + (market.status === 'resolved' ? (market.outcome ? 'rgba(0,229,160,.3)' : 'rgba(244,63,94,.3)') : '#333') }}>
          {market.status === 'resolved' ? (market.outcome ? 'YES ✓' : 'NO ✗') : 'Cancelled'}
        </div>
      )}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: cat.bg, borderRadius: '6px', padding: '3px 10px', fontSize: '10px', color: cat.color, marginBottom: '12px', border: '1px solid ' + cat.color + '33' }}>
        <span>{cat.icon}</span>
        <span style={{ textTransform: 'capitalize' as const, letterSpacing: '1px' }}>{market.category}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.5', marginBottom: '16px', color: '#e2e8f0', paddingRight: market.status !== 'open' ? '70px' : '0' }}>
        {market.question}
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#00e5a0', fontWeight: 700 }}>YES {odds.yes}%</span>
          <span style={{ color: '#f43f5e', fontWeight: 700 }}>NO {odds.no}%</span>
        </div>
        <div style={{ height: '6px', background: '#1e2a3a', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: odds.yes + '%', background: 'linear-gradient(90deg, #00e5a0, #7b61ff)', borderRadius: '3px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontSize: '10px', color: '#5a6a80' }}><span style={{ color: '#94a3b8', fontWeight: 600 }}>{fmtVolume(vol)}</span> vol</div>
        <div style={{ fontSize: '10px', color: '#5a6a80' }}>{timeLeft(market.resolution_date)}</div>
        <div style={{ fontSize: '10px', color: '#5a6a80' }}>{market.bets.length} bets</div>
      </div>
      {market.status === 'resolved' && market.resolution_reason && (
        <div style={{ background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '8px', padding: '10px 12px', fontSize: '10px', color: '#5a6a80', lineHeight: '1.6', marginBottom: '14px' }}>
          <span style={{ color: '#00e5a0', fontWeight: 700, display: 'block', marginBottom: '3px', fontSize: '9px', letterSpacing: '1px' }}>AI RESOLUTION</span>
          {market.resolution_reason}
        </div>
      )}
      {market.status === 'open' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onBet(market)} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #00e5a0, #00b87a)', color: '#000', fontFamily: "'Space Mono', monospace", fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Place Bet</button>
          {!isDemo && (
            <button onClick={() => onResolve(market.id)} style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #7b61ff', background: 'rgba(123,97,255,.1)', color: '#7b61ff', fontFamily: "'Space Mono', monospace", fontSize: '10px', cursor: 'pointer' }}>Resolve ⬡</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function OracleApp() {
  const [tab, setTab] = useState<Tab>('markets');
  const [markets, setMarkets] = useState<(Market & { id: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [pk, setPk] = useState('');
  const [showPk, setShowPk] = useState(false);
  const [filter, setFilter] = useState('all');
  const [betModal, setBetModal] = useState<(Market & { id: number }) | null>(null);
  const [betSide, setBetSide] = useState<'yes' | 'no'>('yes');
  const [betAmount, setBetAmount] = useState('100');
  const [bettor, setBettor] = useState('');
  const [useDemo, setUseDemo] = useState(!CONTRACT);
  const [cQuestion, setCQuestion] = useState('');
  const [cCategory, setCCategory] = useState('crypto');
  const [cUrl, setCUrl] = useState('');
  const [cDate, setCDate] = useState('');
  const [cCreator, setCCreator] = useState('');

  const loadMarkets = useCallback(async () => {
    if (useDemo) {
      setMarkets(DEMO_MARKETS.map((m, i) => ({ ...m, id: i })));
      return;
    }
    try {
      const raw = await rpcCall('get_all_markets');
      if (raw) setMarkets(JSON.parse(raw));
    } catch {
      setUseDemo(true);
      setMarkets(DEMO_MARKETS.map((m, i) => ({ ...m, id: i })));
    }
  }, [useDemo]);

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  async function handleBet() {
    if (!betModal) return;
    if (useDemo) {
      setMarkets(prev => prev.map(m => {
        if (m.id !== betModal.id) return m;
        const amt = parseInt(betAmount) || 0;
        return { ...m, total_yes: betSide === 'yes' ? m.total_yes + amt : m.total_yes, total_no: betSide === 'no' ? m.total_no + amt : m.total_no, bets: [...m.bets, { bettor: bettor || 'You', side: betSide, amount: amt }] };
      }));
      setBetModal(null);
      return;
    }
    if (!pk) { setError('Enter private key.'); return; }
    setLoading(true);
    setLoadingMsg('Placing bet on-chain...');
    try {
      const hash = await rpcWrite('place_bet', [betModal.id, bettor || 'anonymous', betSide, parseInt(betAmount)], pk);
      setTxHash(hash);
      setLoadingMsg('Waiting for confirmation...');
      await waitTx(hash);
      await loadMarkets();
      setBetModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  async function handleResolve(marketId: number) {
    if (!pk) { setError('Enter private key to resolve.'); return; }
    setLoading(true);
    setLoadingMsg('Fetching live sources... AI reasoning across validators...');
    setError('');
    try {
      const hash = await rpcWrite('resolve_market', [marketId], pk);
      setTxHash(hash);
      setLoadingMsg('Waiting for AI consensus (30s-3min)...');
      await waitTx(hash);
      setLoadingMsg('Loading result...');
      await loadMarkets();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  async function handleCreate() {
    if (!cQuestion || !cUrl || !cDate || !cCreator) { setError('Fill all fields.'); return; }
    if (useDemo) {
      const nm: Market & { id: number } = { id: markets.length, question: cQuestion, category: cCategory, resolution_url: cUrl, resolution_date: cDate, creator: cCreator, status: 'open', outcome: null, resolution_reason: '', total_yes: 0, total_no: 0, bets: [] };
      setMarkets(prev => [nm, ...prev]);
      setCQuestion(''); setCUrl(''); setCDate(''); setCCreator('');
      setTab('markets');
      return;
    }
    if (!pk) { setError('Enter privat
