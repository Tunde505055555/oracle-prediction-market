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
    if (!pk) { setError('Enter private key.'); return; }
    setLoading(true);
    setLoadingMsg('Creating market on-chain...');
    try {
      const hash = await rpcWrite('create_market', [cQuestion, cCategory, cUrl, cDate, cCreator], pk);
      setTxHash(hash);
      setLoadingMsg('Confirming...');
      await waitTx(hash);
      await loadMarkets();
      setTab('markets');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  const filtered = markets.filter(m => filter === 'all' || m.category === filter || (filter === 'resolved' && m.status === 'resolved'));
  const openCount = markets.filter(m => m.status === 'open').length;
  const totalVol = markets.reduce((a, m) => a + m.total_yes + m.total_no, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#060b12', color: '#e2e8f0', fontFamily: "'Space Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes rot{to{transform:rotate(360deg)}}
        @keyframes fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        input::placeholder,textarea::placeholder{color:#2a3a4a}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1e2a3a;border-radius:2px}
      `}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: 'linear-gradient(rgba(0,229,160,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,160,.015) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse, rgba(0,229,160,.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <header style={{ borderBottom: '1px solid #1e2a3a', padding: '0 32px', background: 'rgba(6,11,18,.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #00e5a0, #7b61ff)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', boxShadow: '0 0 20px rgba(0,229,160,.3)' }}>⬡</div>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '20px', fontWeight: 800, letterSpacing: '-1px' }}>Oracle</div>
                <div style={{ fontSize: '8px', color: '#5a6a80', letterSpacing: '2px', textTransform: 'uppercase' as const, marginTop: '-2px' }}>AI Prediction Market</div>
              </div>
            </div>
            <nav style={{ display: 'flex', gap: '2px' }}>
              {(['markets', 'create', 'resolve', 'portfolio'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', border: 'none', borderRadius: '6px', background: tab === t ? 'rgba(0,229,160,.1)' : 'none', color: tab === t ? '#00e5a0' : '#5a6a80', fontFamily: "'Space Mono', monospace", fontSize: '10px', cursor: 'pointer', textTransform: 'capitalize' as const, borderBottom: tab === t ? '2px solid #00e5a0' : '2px solid transparent' }}>{t}</button>
              ))}
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {useDemo && <span style={{ fontSize: '9px', background: 'rgba(247,147,26,.15)', color: '#F7931A', border: '1px solid rgba(247,147,26,.3)', borderRadius: '4px', padding: '2px 8px' }}>DEMO</span>}
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e5a0', boxShadow: '0 0 8px #00e5a0', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '9px', color: '#5a6a80' }}>GenLayer Testnet</span>
            </div>
          </div>
        </header>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px' }}>
          {tab === 'markets' && (
            <div style={{ animation: 'fadeup .3s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
                {[{ label: 'Open Markets', value: openCount, color: '#00e5a0' }, { label: 'Total Volume', value: fmtVolume(totalVol), color: '#7b61ff' }, { label: 'AI Resolved', value: markets.filter(m => m.status === 'resolved').length, color: '#f7c948' }, { label: 'Categories', value: 5, color: '#F7931A' }].map(s => (
                  <div key={s.label} style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '12px', padding: '16px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, fontFamily: "'Syne', sans-serif", marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '9px', color: '#5a6a80', letterSpacing: '2px', textTransform: 'uppercase' as const }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'linear-gradient(135deg, rgba(0,229,160,.06) 0%, rgba(123,97,255,.06) 100%)', border: '1px solid rgba(0,229,160,.15)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '24px' }}>⬡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#00e5a0', marginBottom: '3px' }}>Powered by GenLayer Intelligent Contracts</div>
                  <div style={{ fontSize: '10px', color: '#5a6a80' }}>Markets resolve autonomously — AI fetches live data from CoinGecko, OpenFootball, Reuters and 5 validators reach consensus. No human resolvers. No disputes.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
                {['all', 'crypto', 'sports', 'politics', 'weather', 'entertainment', 'resolved'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: '20px', border: '1px solid ' + (filter === f ? '#00e5a0' : '#1e2a3a'), background: filter === f ? 'rgba(0,229,160,.1)' : 'none', color: filter === f ? '#00e5a0' : '#5a6a80', fontFamily: "'Space Mono', monospace", fontSize: '10px', cursor: 'pointer', textTransform: 'capitalize' as const }}>
                    {f !== 'all' && f !== 'resolved' && CATEGORIES[f] ? CATEGORIES[f].icon + ' ' : ''}{f}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {filtered.map(m => <MarketCard key={m.id} market={m} onBet={setBetModal} onResolve={handleResolve} isDemo={useDemo} />)}
                {filtered.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center' as const, padding: '60px', color: '#5a6a80', fontSize: '12px' }}>
                    No markets found. <span style={{ color: '#00e5a0', cursor: 'pointer' }} onClick={() => setTab('create')}>Create one →</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === 'create' && (
            <div style={{ maxWidth: '600px', margin: '0 auto', animation: 'fadeup .3s ease' }}>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Create a Market</h1>
                <p style={{ fontSize: '11px', color: '#5a6a80', lineHeight: '1.8' }}>Anyone can create a prediction market. When the resolution date arrives, the AI fetches your resolution URL, cross-references live sources, and resolves autonomously.</p>
              </div>
              <div style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '12px', padding: '24px' }}>
                {[{ label: 'Your Question', placeholder: 'Will Bitcoin exceed $100,000 before July 2025?', value: cQuestion, set: setCQuestion, type: 'textarea' }, { label: 'Your Name / Address', placeholder: '0x... or your name', value: cCreator, set: setCCreator }, { label: 'Resolution URL', placeholder: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', value: cUrl, set: setCUrl }, { label: 'Resolution Date', placeholder: '2025-07-01', value: cDate, set: setCDate }].map(f => (
                  <div key={f.label} style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#5a6a80', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} rows={3} style={{ width: '100%', background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '8px', padding: '10px 12px', color: '#e2e8f0', fontFamily: "'Space Mono', monospace", fontSize: '12px', outline: 'none', resize: 'vertical' as const }} />
                    ) : (
                      <input type="text" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={{ width: '100%', background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '8px', padding: '10px 12px', color: '#e2e8f0', fontFamily: "'Space Mono', monospace", fontSize: '12px', outline: 'none' }} />
                    )}
                  </div>
                ))}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#5a6a80', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Category</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <button key={k} onClick={() => setCCategory(k)} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid ' + (cCategory === k ? v.color : '#1e2a3a'), background: cCategory === k ? v.bg : 'none', color: cCategory === k ? v.color : '#5a6a80', fontFamily: "'Space Mono', monospace", fontSize: '10px', cursor: 'pointer' }}>{v.icon} {k}</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleCreate} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #00e5a0, #7b61ff)', color: '#000', fontFamily: "'Space Mono', monospace", fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {loading ? '⬡ Creating...' : '+ Create Market'}
                </button>
              </div>
            </div>
          )}
          {tab === 'resolve' && (
            <div style={{ maxWidth: '700px', margin: '0 auto', animation: 'fadeup .3s ease' }}>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>AI Resolution</h1>
                <p style={{ fontSize: '11px', color: '#5a6a80', lineHeight: '1.8' }}>Click resolve on any open market. GenLayer AI fetches 3 live sources and 5 validators reach consensus. Takes 30 seconds to 3 minutes.</p>
              </div>
              <div style={{ background: '#0d1117', border: '1px solid rgba(123,97,255,.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', color: '#7b61ff', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px' }}>HOW AI RESOLUTION WORKS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                  {[{ n: '1', t: 'Fetch Sources', d: 'gl.get_webpage() pulls live data from 3 real APIs' }, { n: '2', t: 'AI Reasons', d: 'gl.exec_prompt() cross-references all evidence' }, { n: '3', t: 'Consensus', d: '5 validators agree via eq_principle_non_comparative' }].map(s => (
                    <div key={s.n} style={{ textAlign: 'center' as const, padding: '12px', background: '#0a0e14', borderRadius: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(123,97,255,.15)', border: '1px solid rgba(123,97,255,.3)', color: '#7b61ff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{s.n}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>{s.t}</div>
                      <div style={{ fontSize: '9px', color: '#5a6a80', lineHeight: '1.6' }}>{s.d}</div>
                    </div>
                  ))}
                </div>
              </div>
              {markets.filter(m => m.status === 'open').map(m => {
                const cat = CATEGORIES[m.category] || CATEGORIES.crypto;
                const odds = calcOdds(m.total_yes, m.total_no);
                return (
                  <div key={m.id} style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '10px', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ fontSize: '20px' }}>{cat.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{m.question}</div>
                      <div style={{ fontSize: '9px', color: '#5a6a80' }}>YES {odds.yes}% · {fmtVolume(m.total_yes + m.total_no)} vol · {timeLeft(m.resolution_date)}</div>
                    </div>
                    <button onClick={() => handleResolve(m.id)} disabled={loading || useDemo} style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #7b61ff', background: 'rgba(123,97,255,.1)', color: useDemo ? '#333' : '#7b61ff', fontFamily: "'Space Mono', monospace", fontSize: '10px', cursor: useDemo ? 'not-allowed' : 'pointer', fontWeight: 700 }}>{loading ? '...' : useDemo ? 'Connect Contract' : 'Resolve ⬡'}</button>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'portfolio' && (
            <div style={{ maxWidth: '700px', margin: '0 auto', animation: 'fadeup .3s ease' }}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Your Positions</h1>
              <p style={{ fontSize: '11px', color: '#5a6a80', marginBottom: '24px' }}>Enter your name or address to see your bets.</p>
              <div style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <input type="text" value={bettor} onChange={e => setBettor(e.target.value)} placeholder="Your name or 0x address..." style={{ width: '100%', background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '7px', padding: '10px 12px', color: '#e2e8f0', fontFamily: "'Space Mono', monospace", fontSize: '12px', outline: 'none' }} />
              </div>
              {bettor && markets.flatMap(m => m.bets.filter(b => b.bettor === bettor).map(b => ({ ...b, market: m }))).map((b, i) => (
                <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '10px', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '4px 10px', borderRadius: '6px', background: b.side === 'yes' ? 'rgba(0,229,160,.1)' : 'rgba(244,63,94,.1)', color: b.side === 'yes' ? '#00e5a0' : '#f43f5e', fontSize: '10px', fontWeight: 700 }}>{b.side.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', marginBottom: '3px' }}>{b.market.question}</div>
                    <div style={{ fontSize: '9px', color: '#5a6a80' }}>{b.amount} tokens · {b.market.status === 'resolved' ? (b.market.outcome === (b.side === 'yes') ? '🎉 Won' : '❌ Lost') : 'Pending'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && (
            <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.4)', zIndex: 1000 }}>
              <div style={{ fontSize: '18px', animation: 'rot 2s linear infinite' }}>⬡</div>
              <div>
                <div style={{ fontSize: '11px', color: '#00e5a0', fontWeight: 700, marginBottom: '2px' }}>GenLayer AI Processing</div>
                <div style={{ fontSize: '10px', color: '#5a6a80' }}>{loadingMsg}</div>
                {txHash && <div style={{ fontSize: '8px', color: '#374a5e', marginTop: '3px' }}>{txHash.slice(0, 20)}...</div>}
              </div>
            </div>
          )}
          {error && (
            <div style={{ position: 'fixed', bottom: '24px', left: '24px', background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '11px', color: '#f43f5e', zIndex: 1000, maxWidth: '300px' }}>
              ⚠ {error}
              <button onClick={() => setError('')} style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>×</button>
            </div>
          )}
          <div style={{ marginTop: '40px', background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '9px', color: '#5a6a80', letterSpacing: '2px', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' }}>🔑 Testnet Key</span>
            <input type={showPk ? 'text' : 'password'} value={pk} onChange={e => setPk(e.target.value)} placeholder="0x... testnet private key" style={{ flex: 1, background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '6px', padding: '8px 12px', color: '#e2e8f0', fontFamily: "'Space Mono', monospace", fontSize: '11px', outline: 'none' }} />
            <button onClick={() => setShowPk(!showPk)} style={{ background: 'none', border: '1px solid #1e2a3a', borderRadius: '5px', color: '#5a6a80', padding: '7px 10px', cursor: 'pointer', fontSize: '10px', fontFamily: "'Space Mono', monospace" }}>{showPk ? 'Hide' : 'Show'}</button>
            <button onClick={() => setUseDemo(!useDemo)} style={{ background: useDemo ? 'rgba(247,147,26,.1)' : 'rgba(0,229,160,.1)', border: '1px solid ' + (useDemo ? 'rgba(247,147,26,.3)' : 'rgba(0,229,160,.3)'), borderRadius: '5px', color: useDemo ? '#F7931A' : '#00e5a0', padding: '7px 12px', cursor: 'pointer', fontSize: '9px', fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' as const }}>{useDemo ? 'Demo Mode' : 'Live Mode'}</button>
          </div>
        </main>
      </div>
      {betModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }} onClick={() => setBetModal(null)}>
          <div style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: '16px', padding: '28px', maxWidth: '420px', width: '100%', animation: 'fadeup .2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', fontFamily: "'Syne', sans-serif" }}>Place Your Bet</div>
            <div style={{ fontSize: '11px', color: '#5a6a80', marginBottom: '20px', lineHeight: '1.6' }}>{betModal.question}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {(['yes', 'no'] as const).map(s => {
                const odds = calcOdds(betModal.total_yes, betModal.total_no);
                return (
                  <button key={s} onClick={() => setBetSide(s)} style={{ padding: '14px', borderRadius: '10px', border: '2px solid', borderColor: betSide === s ? (s === 'yes' ? '#00e5a0' : '#f43f5e') : '#1e2a3a', background: betSide === s ? (s === 'yes' ? 'rgba(0,229,160,.1)' : 'rgba(244,63,94,.1)') : 'none', color: s === 'yes' ? '#00e5a0' : '#f43f5e', fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}>
                    {s === 'yes' ? 'YES' : 'NO'}
                    <div style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace", fontWeight: 400 }}>{s === 'yes' ? odds.yes : odds.no}%</div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#5a6a80', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Amount (testnet tokens)</label>
              <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)} style={{ width: '100%', background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '7px', padding: '10px 12px', color: '#e2e8f0', fontFamily: "'Space Mono', monospace", fontSize: '14px', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {[50, 100, 250, 500].map(a => (
                  <button key={a} onClick={() => setBetAmount(String(a))} style={{ flex: 1, padding: '5px', background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '5px', color: '#5a6a80', fontFamily: "'Space Mono', monospace", fontSize: '10px', cursor: 'pointer' }}>{a}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#5a6a80', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Your Name / Address</label>
              <input type="text" value={bettor} onChange={e => setBettor(e.target.value)} placeholder="0x... or your name" style={{ width: '100%', background: '#0a0e14', border: '1px solid #1e2a3a', borderRadius: '7px', padding: '10px 12px', color: '#e2e8f0', fontFamily: "'Space Mono', monospace", fontSize: '12px', outline: 'none' }} />
            </div>
            <button onClick={handleBet} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: betSide === 'yes' ? 'linear-gradient(135deg, #00e5a0, #00b87a)' : 'linear-gradient(135deg, #f43f5e, #c4143a)', color: '#fff', fontFamily: "'Space Mono', monospace", fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Bet {betAmount} tokens on {betSide.toUpperCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
