import { useState, useEffect } from 'react';
import { getWallet, depositWallet } from '../api/api.js';
import { useToast } from '../context/ToastContext';

export default function WalletPage() {
  const { addToast } = useToast();
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [depositing, setDepositing] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await getWallet(); setWallet(r.data.data || { balance: 0, transactions: [] }); }
    catch { addToast('Failed to load wallet', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { addToast('Enter a valid amount', 'warning'); return; }
    setDepositing(true);
    try {
      await depositWallet(Number(amount));
      addToast(`₹${amount} added to wallet!`, 'success');
      setAmount('');
      load();
    } catch (err) { addToast(err.response?.data?.message || 'Deposit failed', 'error'); }
    finally { setDepositing(false); }
  };

  const quickAmounts = [500, 1000, 2000, 5000];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">💰 RMS Wallet</h1>
        <p className="page-subtitle">Your in-app wallet for instant booking payments and refunds</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--sp-xl)', alignItems: 'start' }}>
        {/* Balance Card */}
        <div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #0d1533, #111827)', borderColor: 'rgba(59,130,246,0.3)', marginBottom: 'var(--sp-lg)' }}>
            <div className="text-muted text-sm" style={{ marginBottom: 'var(--sp-sm)' }}>💰 Available Balance</div>
            {loading ? (
              <div className="skeleton" style={{ height: 48, width: '70%', marginBottom: 'var(--sp-md)' }} />
            ) : (
              <div style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 'var(--sp-md)' }}>
                ₹{wallet.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="text-xs text-muted">RMS Wallet · Instant payments & auto-refunds</div>
          </div>

          {/* Deposit */}
          <div className="card">
            <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>Add Funds</h3>
            <form onSubmit={handleDeposit} className="flex flex-col gap-md">
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input className="form-input" type="number" min={1} placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="flex gap-xs flex-wrap">
                {quickAmounts.map((a) => (
                  <button key={a} type="button" className="pill" onClick={() => setAmount(String(a))}>₹{a}</button>
                ))}
              </div>
              <button type="submit" className="btn btn-primary" disabled={depositing}>
                {depositing ? <><span className="spinner" /> Adding...</> : '+ Add Money'}
              </button>
            </form>
          </div>
        </div>

        {/* Transaction History */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--sp-lg)', borderBottom: '1px solid var(--clr-border)' }}>
            <h3 className="section-title">Transaction History</h3>
          </div>

          {loading ? (
            <div className="spinner-center"><div className="spinner" /></div>
          ) : !wallet.transactions?.length ? (
            <div className="empty-state">
              <span className="empty-state-icon">📋</span>
              <h3>No transactions yet</h3>
              <p>Add funds or book a ticket to see transactions here.</p>
            </div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {[...wallet.transactions].reverse().map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: 'var(--sp-md) var(--sp-lg)', borderBottom: '1px solid var(--clr-border)' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: t.type === 'credit' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
                  }}>
                    {t.type === 'credit' ? '↑' : '↓'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t.description}</div>
                    <div className="text-xs text-muted">{new Date(t.date).toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: t.type === 'credit' ? 'var(--clr-green)' : 'var(--clr-red)' }}>
                    {t.type === 'credit' ? '+' : '-'}₹{t.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
