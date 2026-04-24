import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const r = await adminApi.getPayments(); setPayments(r.payments || r || []); }
    catch { toast.error('Failed to load payments'); }
    setLoading(false);
  };

  const filtered = payments.filter(p => {
    const m = p.paymentId?.toLowerCase().includes(search.toLowerCase()) || p.userId?.name?.toLowerCase().includes(search.toLowerCase());
    const f = filter === 'all' || p.status === filter;
    return m && f;
  });

  const total = payments.filter(p => p.status === 'success').reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Payment <span className="gradient-text">Management</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{payments.length} total transactions</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Revenue', value: `₹${total.toLocaleString()}`, icon: '💰', color: '#10B981' },
          { label: 'Successful', value: payments.filter(p => p.status === 'success').length, icon: '✅', color: '#10B981' },
          { label: 'Failed', value: payments.filter(p => p.status === 'failed').length, icon: '❌', color: '#EF4444' },
          { label: 'Pending', value: payments.filter(p => p.status === 'pending').length, icon: '⏳', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['all', 'success', 'failed', 'pending'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
        ))}
        <div className="search-bar" style={{ width: 240, marginLeft: 'auto' }}>
          <span className="search-icon">🔍</span>
          <input className="input" placeholder="Search payments..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-card">
        <div className="table-header"><h3>Transactions ({filtered.length})</h3></div>
        <table>
          <thead><tr><th>Payment ID</th><th>Customer</th><th>Booking</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? Array(4).fill(0).map((_, i) => <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 40 }} /></td></tr>) :
              filtered.map((p, i) => (
                <tr key={p._id} className="fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--primary-light)' }}>#{String(p._id).slice(-8).toUpperCase()}</td>
                  <td>{p.userId?.name || 'Customer'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-sub)' }}>#{String(p.bookingId).slice(-6)}</td>
                  <td style={{ fontWeight: 800, color: '#10B981', fontSize: 15 }}>₹{p.amount}</td>
                  <td><span className="badge badge-accepted" style={{ fontSize: 10 }}>{p.paymentMethod || 'UPI'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-sub)' }}>{new Date(p.createdAt || Date.now()).toLocaleString()}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>No payments found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
