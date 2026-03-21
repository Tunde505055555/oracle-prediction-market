'use client';
import { useState, useEffect, useCallback } from 'react';

const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com:8443/api';
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x4b1ad1E88dcAAd05D362a6736bD51B1EC0513509';

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

declare global {
  interface Window {
    ethereum?: any;
  }
}

async function rpcCall(method: string, args: any[] = []): Promise<any> {
  const r = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'gen_call', params: [{ to: CONTRACT, data: { method, args } }, 'latest'], id: Date.now() }) });
  return (await r.json())?.result;
}

async function rpcWriteWithMetaMask(method: string, args: any[], from: string): Promise<string> {
  const data = JSON.stringify({ method, args });
  const txParams = { from, to: CONTRACT, data: '0x' + Buffer.from(data).toString('hex'), value: '0x0' };
  return await window.ethereum.request({ method: 'eth_sendTransaction', params: [txParams] });
}

async function waitTx(hash: string): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const r = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'gen_getTransactionReceipt', params: [hash], id: Date.now() }) });
    if ((await r.json())?.result?.status === 'FINALIZED') return true;
  }
  return false;
}

const CATS: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  crypto:        { icon: '₿', color: '#F59E0B', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)' },
  sports:        { icon: '⚽', color: '#34D399', bg: 'rgba(52,211,153,.12)', border: 'rgba(52,211,153,.3)' },
  politics:      { icon: '🏛', color: '#818CF8', bg: 'rgba(129,140,248,.12)', border: 'rgba(129,140,248,.3)' },
  weather:       { icon: '🌤', color: '#38BDF8', bg: 'rgba(56,189,248,.12)', border: 'rgba(56,189,248,.3)' },
  entertainment: { icon: '🎬', color: '#FB7185', bg: 'rgba(251,113,133,.12)', border: 'rgba(251,113,133,.3)' },
};

const DEMOS: Omit<Market, 'id'>[] = [
  { question: 'Will Bitcoin exceed $100,000 before July 2025?', category: 'crypto', resolution_url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', resolution_date: '2025-07-01', creator: '0xdemo1', status: 'open', outcome: null, resolution_reason: '', total_yes: 8400, total_no: 3200, bets: [] },
  { question: 'Will Nigeria qualify for the 2026 FIFA World Cup?', category: 'sports', resolution_url: 'https://openfootball.github.io/england/2025-26/1-premierleague.json', resolution_date: '2025-11-01', creator: '0xdemo2', status: 'open', outcome: null, resolution_reason: '', total_yes: 5100, total_no: 6700, bets: [] },
  { question: 'Will Ethereum exceed $5,000 before June 2025?', category: 'crypto', resolution_url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', resolution_date: '2025-06-30', creator: '0xdemo3', status: 'open', outcome: null, resolution_reason: '', total_yes: 4200, total_no: 4800, bets: [] },
  { question: 'Will there be a US Federal Reserve rate cut before September 2025?', category: 'politics', resolution_url: 'https://www.reuters.com/markets/us/', resolution_date: '2025-09-01', creator: '0xdemo4', status: 'open', outcome: null, resolution_reason: '', total_yes: 7300, total_no: 2100, bets: [] },
  { question: 'Will Arsenal finish in the top 4 of the Premier League 2024-25?', category: 'sports', resolution_url: 'https://openfootball.github.io/england/2024-25/1-premierleague.json', resolution_date: '2025-05-20', creator: '0xdemo5', status: 'open', outcome: null, resolution_reason: '', total_yes: 6800, total_no: 2200, bets: [] },
  { question: 'Will Solana exceed $300 before May 2025?', category: 'crypto', resolution_url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', resolution_date: '2025-05-01', creator: '0xdemo6', status: 'resolved', outcome: false, resolution_reason: '[HIGH confidence] CoinGecko API shows SOL at $142.30 USD, significantly below the $300 threshold.', total_yes: 2900, total_no: 6100, bets: [] },
];

function calcOdds(yes: number, no: number) {
  const t = yes + no;
  if (!t) return { yes: 50, no: 50 };
  return { yes: Math.round((yes / t) * 100), no: Math.round((no / t) * 100) };
}
function fmtVol(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function timeLeft(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 30) return Math.floor(days / 30) + 'mo';
  if (days > 0) return days + 'd left';
  return 'Closing soon';
}

function Card({ m, onBet, onResolve, walletAddress }: {
  m: Market & { id: number };
  onBet: (m: Market) => void;
  onResolve: (id: number) => void;
  walletAddress: string;
}) {
  const cat = CATS[m.category] || CATS.crypto;
  const o = calcOdds(m.total_yes, m.total_no);
  const v = m.total_yes + m.total_no;
  const resolved = m.status === 'resolved';

  return (
    <div style={{ background: 'linear-gradient(145deg,#1a1f35 0%,#141828 100%)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '16px', padding: '22px', position: 'relative', overflow: 'hidden', transition: 'transform .2s,box-shadow .2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(0,0,0,.4)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: resolved ? (m.outcome ? 'linear-gradient(90deg,#34D399,#059669)' : 'linear-gradient(90deg,#FB7185,#E11D48)') : 'linear-gradient(90deg,' + cat.color + ',transparent)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: cat.bg, borderRadius: '20px', padding: '4px 12px', fontSize: '10px', color: cat.color, border: '1px solid ' + cat.border, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' as const }}>
          {cat.icon} {m.category}
        </div>
        {resolved ? (
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: m.outcome ? 'rgba(52,211,153,.15)' : 'rgba(251,113,133,.15)', color: m.outcome ? '#34D399' : '#FB7185', border: '1px solid ' + (m.outcome ? 'rgba(52,211,153,.3)' : 'rgba(251,113,133,.3)') }}>
            {m.outcome ? 'YES ✓' : 'NO ✗'}
          </div>
        ) : (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.35)', fontFamily: 'monospace' }}>{timeLeft(m.resolution_date)}</div>
        )}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, lineHeight: '1.5', marginBottom: '18px', color: '#F1F5F9', fontFamily: "'Fraunces',serif" }}>{m.question}</div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
          <span style={{ fontSize: '12px', color: '#34D399', fontWeight: 700 }}>YES {o.yes}%</span>
          <span style={{ fontSize: '12px', color: '#FB7185', fontWeight: 700 }}>NO {o.no}%</span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: o.yes + '%', background: 'linear-gradient(90deg,#34D399,#F59E0B)', borderRadius: '4px', transition: 'width .6s ease' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '11px', color: 'rgba(255,255,255,.4)' }}>
        <span>📊 {fmtVol(v)} vol</span>
        <span>🎯 {m.bets.length} bets</span>
      </div>
      {resolved && m.resolution_reason && (
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '10px', padding: '10px 12px', fontSize: '10px', color: 'rgba(255,255,255,.5)', lineHeight: '1.7' }}>
          <span style={{ color: '#F59E0B', fontWeight: 700, display: 'block', fontSize: '9px', letterSpacing: '1px', marginBottom: '3px' }}>⬡ AI RESOLUTION</span>
          {m.resolution_reason}
        </div>
      )}
      {!resolved && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onBet(m)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Place Bet</button>
          {walletAddress && <button onClick={() => onResolve(m.id)} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(129,140,248,.4)', background: 'rgba(129,140,248,.1)', color: '#818CF8', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer' }}>Resolve ⬡</button>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('markets');
  const [markets, setMarkets] = useState<(Market & { id: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [betModal, setBetModal] = useState<(Market & { id: number }) | null>(null);
  const [betSide, setBetSide] = useState<'yes' | 'no'>('yes');
  const [betAmount, setBetAmount] = useState('100');
  const [bettor, setBettor] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletModal, setWalletModal] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [cQ, setCQ] = useState('');
  const [cCat, setCCat] = useState('crypto');
  const [cUrl, setCUrl] = useState('');
  const [cDate, setCDate] = useState('');
  const [cCreator, setCCreator] = useState('');

  useEffect(() => {
    setHasMetaMask(typeof window !== 'undefined' && !!window.ethereum);
  }, []);

  const load = useCallback(async () => {
    if (isDemo) { setMarkets(DEMOS.map((m, i) => ({ ...m, id: i }))); return; }
    try {
      const raw = await rpcCall('get_all_markets');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.length === 0) {
          setMarkets(DEMOS.map((m, i) => ({ ...m, id: i })));
        } else {
          setMarkets(parsed);
        }
      } else {
        setMarkets(DEMOS.map((m, i) => ({ ...m, id: i })));
      }
    } catch {
      setMarkets(DEMOS.map((m, i) => ({ ...m, id: i })));
    }
  }, [isDemo]);

  useEffect(() => { load(); }, [load]);

  async function connectMetaMask() {
    if (!window.ethereum) { setError('MetaMask not found. Please install MetaMask.'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) { setWalletAddress(accounts[0]); setBettor(accounts[0]); setIsDemo(false); setWalletModal(false); }
    } catch { setError('Wallet connection rejected.'); }
  }

  async function handleBet() {
    if (!betModal) return;
    if (!walletAddress) { setWalletModal(true); return; }
    if (isDemo) {
      setMarkets(prev => prev.map(m => m.id !== betModal.id ? m : { ...m, total_yes: betSide === 'yes' ? m.total_yes + (parseInt(betAmount) || 0) : m.total_yes, total_no: betSide === 'no' ? m.total_no + (parseInt(betAmount) || 0) : m.total_no, bets: [...m.bets, { bettor: bettor || walletAddress, side: betSide, amount: parseInt(betAmount) || 0 }] }));
      setBetModal(null); return;
    }
    setLoading(true); setLoadingMsg('Sending via MetaMask...'); setError('');
    try {
      const hash = await rpcWriteWithMetaMask('place_bet', [betModal.id, bettor || walletAddress, betSide, parseInt(betAmount)], walletAddress);
      setTxHash(hash); setLoadingMsg('Confirming on GenLayer...'); await waitTx(hash); await load(); setBetModal(null);
    } catch (e: any) { setError(e.message || 'Transaction failed'); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  async function handleResolve(id: number) {
    if (!walletAddress) { setWalletModal(true); return; }
    setLoading(true); setLoadingMsg('Fetching live data across 5 validators...'); setError('');
    try {
      const hash = await rpcWriteWithMetaMask('resolve_market', [id], walletAddress);
      setTxHash(hash); setLoadingMsg('AI consensus in progress (30s-3min)...'); await waitTx(hash); await load();
    } catch (e: any) { setError(e.message || 'Transaction failed'); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  async function handleCreate() {
    if (!cQ || !cUrl || !cDate || !cCreator) { setError('Please fill all fields.'); return; }
    if (!walletAddress) { setWalletModal(true); return; }
    if (isDemo) {
      setMarkets(prev => [{ id: prev.length, question: cQ, category: cCat, resolution_url: cUrl, resolution_date: cDate, creator: cCreator, status: 'open', outcome: null, resolution_reason: '', total_yes: 0, total_no: 0, bets: [] }, ...prev]);
      setCQ(''); setCUrl(''); setCDate(''); setCCreator(''); setTab('markets'); return;
    }
    setLoading(true); setLoadingMsg('Creating market on-chain...');
    try {
      const hash = await rpcWriteWithMetaMask('create_market', [cQ, cCat, cUrl, cDate, cCreator], walletAddress);
      setTxHash(hash); await waitTx(hash); await load(); setTab('markets');
    } catch (e: any) { setError(e.message || 'Transaction failed'); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  const filtered = markets.filter(m => filter === 'all' || m.category === filter || (filter === 'resolved' && m.status === 'resolved'));
  const openCount = markets.filter(m => m.status === 'open').length;
  const totalVol = markets.reduce((a, m) => a + m.total_yes + m.total_no, 0);
  const shortAddr = walletAddress ? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4) : '';

  return (
    <div style={{ minHeight: '100vh', background: '#0F1117', color: '#F1F5F9', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,.2)}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#2a2f45;border-radius:2px}
        button:active{transform:scale(.97)!important}
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '70%', background: 'radial-gradient(ellipse,rgba(245,158,11,.07) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '70%', background: 'radial-gradient(ellipse,rgba(129,140,248,.07) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '40%', left: '40%', width: '40%', height: '50%', background: 'radial-gradient(ellipse,rgba(251,113,133,.05) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)', backgroundSize: '52px 52px' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header style={{ borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 32px', background: 'rgba(15,17,23,.85)', backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '68px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#F59E0B,#EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 0 24px rgba(245,158,11,.35)' }}>⬡</div>
              <div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-1px', background: 'linear-gradient(135deg,#F59E0B,#FB7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Oracle</div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.3)', letterSpacing: '2.5px', textTransform: 'uppercase' as const, marginTop: '-2px' }}>AI Prediction Market</div>
              </div>
            </div>
            <nav style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,.04)', borderRadius: '12px', padding: '4px' }}>
              {(['markets', 'create', 'resolve', 'portfolio'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', border: 'none', borderRadius: '9px', background: tab === t ? 'rgba(255,255,255,.1)' : 'none', color: tab === t ? '#F1F5F9' : 'rgba(255,255,255,.4)', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '11px', fontWeight: tab === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' as const, transition: 'all .2s' }}>{t}</button>
              ))}
            </nav>
            <button onClick={() => !walletAddress && setWalletModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: walletAddress ? 'rgba(52,211,153,.1)' : 'rgba(245,158,11,.1)', border: '1px solid ' + (walletAddress ? 'rgba(52,211,153,.3)' : 'rgba(245,158,11,.3)'), borderRadius: '10px', color: walletAddress ? '#34D399' : '#F59E0B', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: walletAddress ? '#34D399' : '#F59E0B', animation: 'pulse 2s infinite', display: 'inline-block' }} />
              {walletAddress ? shortAddr : 'Connect Wallet'}
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

          {tab === 'markets' && (
            <div style={{ animation: 'fadeup .3s ease' }}>
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: '42px', fontWeight: 700, letterSpacing: '-2px', marginBottom: '10px', lineHeight: 1.1 }}>
                  Predict. Bet. <span style={{ background: 'linear-gradient(135deg,#F59E0B,#FB7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get Paid.</span>
                </h1>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,.45)', maxWidth: '520px', lineHeight: 1.8 }}>The only prediction market where AI resolves every outcome. No humans. No disputes. Just on-chain truth.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
                {[{ label: 'Open Markets', value: openCount, icon: '📈', color: '#F59E0B' }, { label: 'Total Volume', value: fmtVol(totalVol), icon: '💰', color: '#34D399' }, { label: 'AI Resolved', value: markets.filter(m => m.status === 'resolved').length, icon: '⬡', color: '#818CF8' }, { label: 'Categories', value: 5, icon: '🗂', color: '#FB7185' }].map(s => (
                  <div key={s.label} style={{ background: 'linear-gradient(145deg,#1a1f35,#141828)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '18px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '40px', opacity: .08 }}>{s.icon}</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, fontFamily: "'Fraunces',serif", marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.35)', letterSpacing: '1px', textTransform: 'uppercase' as const }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,.08),rgba(129,140,248,.08))', border: '1px solid rgba(245,158,11,.15)', borderRadius: '14px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '26px' }}>⬡</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B', marginBottom: '3px' }}>Powered by GenLayer Intelligent Contracts</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', lineHeight: 1.8 }}>AI fetches live data from CoinGecko, OpenFootball and Reuters. 5 validators reach consensus. No human resolvers. Ever.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' as const }}>
                {['all', 'crypto', 'sports', 'politics', 'weather', 'entertainment', 'resolved'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: '20px', border: '1px solid ' + (filter === f ? 'rgba(245,158,11,.5)' : 'rgba(255,255,255,.08)'), background: filter === f ? 'rgba(245,158,11,.12)' : 'transparent', color: filter === f ? '#F59E0B' : 'rgba(255,255,255,.4)', fontFamily: 'monospace', fontSize: '10px', fontWeight: filter === f ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' as const, transition: 'all .2s' }}>
                    {f !== 'all' && f !== 'resolved' && CATS[f] ? CATS[f].icon + ' ' : ''}{f}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '16px' }}>
                {filtered.map(m => <Card key={m.id} m={m} onBet={setBetModal} onResolve={handleResolve} walletAddress={walletAddress} />)}
                {!filtered.length && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center' as const, padding: '60px', color: 'rgba(255,255,255,.25)', fontSize: '13px' }}>
                    No markets found. <span style={{ color: '#F59E0B', cursor: 'pointer' }} onClick={() => setTab('create')}>Create one →</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'create' && (
            <div style={{ maxWidth: '580px', margin: '0 auto', animation: 'fadeup .3s ease' }}>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: '34px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-1px' }}>Create a <span style={{ background: 'linear-gradient(135deg,#F59E0B,#FB7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Market</span></h1>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginBottom: '28px', lineHeight: 1.8 }}>Anyone can create a market. The AI resolves it autonomously using live data on the resolution date.</p>
              <div style={{ background: 'linear-gradient(145deg,#1a1f35,#141828)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '16px', padding: '28px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,.3)', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>Question</label>
                <textarea value={cQ} onChange={e => setCQ(e.target.value)} placeholder="Will Bitcoin exceed $100,000 before July 2025?" rows={3} style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', padding: '11px 14px', color: '#F1F5F9', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '13px', outline: 'none', resize: 'vertical' as const, marginBottom: '16px' }} />
                <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,.3)', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Category</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '16px' }}>
                  {Object.entries(CATS).map(([k, v]) => (
                    <button key={k} onClick={() => setCCat(k)} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid ' + (cCat === k ? v.border : 'rgba(255,255,255,.08)'), background: cCat === k ? v.bg : 'transparent', color: cCat === k ? v.color : 'rgba(255,255,255,.35)', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer' }}>{v.icon} {k}</button>
                  ))}
                </div>
                {[{ label: 'Your Name / Address', val: cCreator, set: setCCreator, ph: '0x... or your name' }, { label: 'Resolution URL', val: cUrl, set: setCUrl, ph: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd' }, { label: 'Resolution Date', val: cDate, set: setCDate, ph: '2025-07-01' }].map(f => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,.3)', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{f.label}</label>
                    <input type="text" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', padding: '11px 14px', color: '#F1F5F9', fontFamily: 'monospace', fontSize: '12px', outline: 'none', marginBottom: '14px' }} />
                  </div>
                ))}
                {error && <div style={{ color: '#FB7185', fontSize: '11px', marginBottom: '12px' }}>⚠ {error}</div>}
                <button onClick={handleCreate} disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  {loading ? '⬡ Creating...' : '+ Create Market'}
                </button>
              </div>
            </div>
          )}

          {tab === 'resolve' && (
            <div style={{ maxWidth: '680px', margin: '0 auto', animation: 'fadeup .3s ease' }}>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: '34px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-1px' }}>AI <span style={{ background: 'linear-gradient(135deg,#818CF8,#FB7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Resolution</span></h1>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginBottom: '28px', lineHeight: 1.8 }}>Click resolve on any market. AI fetches live data from 3 sources and 5 validators reach consensus.</p>
              <div style={{ background: 'linear-gradient(135deg,rgba(129,140,248,.08),rgba(251,113,133,.05))', border: '1px solid rgba(129,140,248,.2)', borderRadius: '14px', padding: '20px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                {[{ n: '1', t: 'Fetch', d: 'gl.get_webpage() pulls from 3 live APIs' }, { n: '2', t: 'Reason', d: 'gl.exec_prompt() cross-references evidence' }, { n: '3', t: 'Consensus', d: '5 validators agree on the verdict' }].map(s => (
                  <div key={s.n} style={{ textAlign: 'center' as const }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(129,140,248,.15)', border: '1px solid rgba(129,140,248,.3)', color: '#818CF8', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{s.n}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>{s.t}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>{s.d}</div>
                  </div>
                ))}
              </div>
              {markets.filter(m => m.status === 'open').map(m => {
                const cat = CATS[m.category] || CATS.crypto;
                const o = calcOdds(m.total_yes, m.total_no);
                return (
                  <div key={m.id} style={{ background: 'linear-gradient(145deg,#1a1f35,#141828)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ fontSize: '22px' }}>{cat.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{m.question}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.3)' }}>YES {o.yes}% · {fmtVol(m.total_yes + m.total_no)} vol · {timeLeft(m.resolution_date)}</div>
                    </div>
                    <button onClick={() => handleResolve(m.id)} disabled={loading || !walletAddress} style={{ padding: '9px 18px', borderRadius: '9px', border: '1px solid rgba(129,140,248,.4)', background: 'rgba(129,140,248,.1)', color: !walletAddress ? 'rgba(255,255,255,.2)' : '#818CF8', fontFamily: 'monospace', fontSize: '10px', cursor: !walletAddress ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                      {loading ? '...' : !walletAddress ? 'Connect wallet' : 'Resolve ⬡'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'portfolio' && (
            <div style={{ maxWidth: '680px', margin: '0 auto', animation: 'fadeup .3s ease' }}>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: '34px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-1px' }}>Your <span style={{ background: 'linear-gradient(135deg,#34D399,#818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Positions</span></h1>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginBottom: '24px' }}>Your connected wallet address is used automatically.</p>
              <div style={{ background: 'linear-gradient(145deg,#1a1f35,#141828)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
                <input type="text" value={bettor} onChange={e => setBettor(e.target.value)} placeholder={walletAddress || '0x... or your name'} style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', padding: '11px 14px', color: '#F1F5F9', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }} />
              </div>
              {bettor && markets.flatMap(m => m.bets.filter(b => b.bettor === bettor).map(b => ({ ...b, market: m }))).map((b, i) => (
                <div key={i} style={{ background: 'linear-gradient(145deg,#1a1f35,#141828)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '5px 12px', borderRadius: '8px', background: b.side === 'yes' ? 'rgba(52,211,153,.15)' : 'rgba(251,113,133,.15)', color: b.side === 'yes' ? '#34D399' : '#FB7185', fontSize: '11px', fontWeight: 700 }}>{b.side.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', marginBottom: '3px' }}>{b.market.question}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.35)' }}>{b.amount} tokens · {b.market.status === 'resolved' ? (b.market.outcome === (b.side === 'yes') ? '🎉 Won' : '❌ Lost') : '⏳ Pending'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div style={{ position: 'fixed', bottom: '28px', right: '28px', background: 'linear-gradient(145deg,#1a1f35,#141828)', border: '1px solid rgba(245,158,11,.3)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 8px 40px rgba(0,0,0,.5)', zIndex: 1000, minWidth: '280px' }}>
              <div style={{ fontSize: '20px', animation: 'spin 2s linear infinite' }}>⬡</div>
              <div>
                <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 600, marginBottom: '3px' }}>GenLayer AI Processing</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)' }}>{loadingMsg}</div>
                {txHash && <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.2)', marginTop: '3px' }}>{txHash.slice(0, 24)}...</div>}
              </div>
            </div>
          )}

          {error && (
            <div style={{ position: 'fixed', bottom: '28px', left: '28px', background: 'rgba(251,113,133,.12)', border: '1px solid rgba(251,113,133,.3)', borderRadius: '10px', padding: '12px 18px', fontSize: '12px', color: '#FB7185', zIndex: 1000, maxWidth: '320px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⚠ {error}
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#FB7185', cursor: 'pointer', fontSize: '16px', marginLeft: 'auto' }}>×</button>
            </div>
          )}
        </main>
      </div>

      {walletModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }} onClick={() => setWalletModal(false)}>
          <div style={{ background: 'linear-gradient(145deg,#1e2340,#161b2e)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '20px', padding: '32px', maxWidth: '420px', width: '100%', animation: 'fadeup .2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>⬡</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>Connect Wallet</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', lineHeight: 1.7 }}>Connect your MetaMask wallet to place bets and resolve markets on GenLayer testnet.</div>
            </div>
            {hasMetaMask ? (
              <button onClick={connectMetaMask} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span>🦊</span> Connect MetaMask
              </button>
            ) : (
              <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: '10px', padding: '16px', marginBottom: '16px', textAlign: 'center' as const }}>
                <div style={{ fontSize: '12px', color: '#F59E0B', marginBottom: '8px' }}>MetaMask not detected</div>
                <a href="https://metamask.io" target="_blank" rel="noreferrer" style={{ color: '#F59E0B', fontSize: '11px' }}>Install MetaMask →</a>
              </div>
            )}
            <div style={{ background: 'rgba(129,140,248,.08)', border: '1px solid rgba(129,140,248,.2)', borderRadius: '10px', padding: '12px 14px', fontSize: '10px', color: 'rgba(255,255,255,.5)', marginBottom: '16px', lineHeight: 1.7 }}>
              ⬡ Add GenLayer Testnet Bradbury to MetaMask<br />
              Network: GenLayer Testnet Bradbury<br />
              RPC: https://rpc.bradbury.genlayer.com<br />
              Chain ID: 9999 · Symbol: GEN
            </div>
            <div style={{ textAlign: 'center' as const }}>
              <button onClick={() => { setIsDemo(true); setWalletModal(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>Continue in Demo Mode</button>
            </div>
          </div>
        </div>
      )}

      {betModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }} onClick={() => setBetModal(null)}>
          <div style={{ background: 'linear-gradient(145deg,#1e2340,#161b2e)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '20px', padding: '28px', maxWidth: '400px', width: '100%', animation: 'fadeup .2s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Place Your Bet</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginBottom: '22px', lineHeight: 1.7 }}>{betModal.question}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              {(['yes', 'no'] as const).map(s => {
                const o = calcOdds(betModal.total_yes, betModal.total_no);
                return (
                  <button key={s} onClick={() => setBetSide(s)} style={{ padding: '16px', borderRadius: '12px', border: '2px solid', borderColor: betSide === s ? (s === 'yes' ? '#34D399' : '#FB7185') : 'rgba(255,255,255,.08)', background: betSide === s ? (s === 'yes' ? 'rgba(52,211,153,.12)' : 'rgba(251,113,133,.12)') : 'transparent', color: s === 'yes' ? '#34D399' : '#FB7185', fontFamily: "'Fraunces',serif", fontSize: '18px', fontWeight: 700, cursor: 'pointer', transition: 'all .2s' }}>
                    {s === 'yes' ? 'YES' : 'NO'}
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 400, marginTop: '3px' }}>{s === 'yes' ? o.yes : o.no}%</div>
                  </button>
                );
              })}
            </div>
            <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,.3)', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Amount</label>
            <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', padding: '11px 14px', color: '#F1F5F9', fontFamily: 'monospace', fontSize: '16px', outline: 'none', marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {[50, 100, 250, 500].map(a => (
                <button key={a} onClick={() => setBetAmount(String(a))} style={{ flex: 1, padding: '7px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '8px', color: 'rgba(255,255,255,.5)', fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer' }}>{a}</button>
              ))}
            </div>
            <button onClick={handleBet} disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: betSide === 'yes' ? 'linear-gradient(135deg,#34D399,#059669)' : 'linear-gradient(135deg,#FB7185,#E11D48)', color: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {walletAddress ? 'Bet ' + betAmount + ' on ' + betSide.toUpperCase() : 'Connect Wallet to Bet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
