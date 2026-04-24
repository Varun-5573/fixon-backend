import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const DEFAULT_COUPONS = [
  { _id: '1', code: 'FIXON10', discount: 10, type: 'percent', minOrder: 300, expiry: '2026-06-30', active: true, used: 142 },
  { _id: '2', code: 'FIRST50', discount: 50, type: 'flat', minOrder: 200, expiry: '2026-05-31', active: true, used: 89 },
  { _id: '3', code: 'SUMMER25', discount: 25, type: 'percent', minOrder: 500, expiry: '2026-07-15', active: true, used: 56 },
  { _id: '4', code: 'CLEAN200', discount: 200, type: 'flat', minOrder: 1000, expiry: '2026-06-01', active: false, used: 234 },
];

const empty = { code: '', discount: '', type: 'percent', minOrder: '', expiry: '', active: true };

export default function CouponsPage() {
  const [coupons, setCoupons] = useState(DEFAULT_COUPONS);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    (async () => {
      try { const r = await adminApi.getCoupons(); if (r?.coupons?.length) setCoupons(r.coupons); }
      catch {}
    })();
  }, []);

  const save = async () => {
    if (!form.code || !form.discount || !form.expiry) return toast.error('Fill all required fields');
    if (form.code.length < 3) return toast.error('Code must be at least 3 characters');
    setSaving(true);
    try {
      const newCoupon = { ...form, _id: Date.now().toString(), used: 0 };
      setCoupons(p => [...p, newCoupon]);
      try { await adminApi.addCoupon(form); } catch {}
      toast.success('Coupon created! 🎉');
      setModal(false);
    } catch {}
    setSaving(false);
  };

  const toggle = async (id) => {
    setCoupons(p => p.map(c => c._id === id ? { ...c, active: !c.active } : c));
    try { await adminApi.toggleCoupon(id); } catch {}
    toast.success('Status updated');
  };

  const doDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    setCoupons(p => p.filter(c => c._id !== id));
    try { await adminApi.deleteCoupon(id); } catch {}
    toast.success('Deleted');
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => { setCopied(code); setTimeout(() => setCopied(''), 2000); });
    toast.success(`Code "${code}" copied!`);
  };

  const isExpired = (date) => new Date(date) < new Date();

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Offers & <span className="gradient-text">Coupons</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{coupons.filter(c => c.active).length} active coupons</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(empty); setModal(true); }}>🎟️ Create Coupon</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Coupons', value: coupons.length, icon: '🎟️', color: '#7C3AED' },
          { label: 'Active', value: coupons.filter(c => c.active && !isExpired(c.expiry)).length, icon: '✅', color: '#10B981' },
          { label: 'Expired', value: coupons.filter(c => isExpired(c.expiry)).length, icon: '⏰', color: '#EF4444' },
          { label: 'Total Used', value: coupons.reduce((a, c) => a + (c.used || 0), 0), icon: '📊', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Coupons Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
        {coupons.map((c, i) => {
          const expired = isExpired(c.expiry);
          return (
            <div key={c._id} className="offer-card fade-in" style={{ animationDelay: `${i * 60}ms`, opacity: expired ? 0.65 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>COUPON CODE</div>
                  <div className="coupon-code" onClick={() => copyCode(c.code)}>
                    {copied === c.code ? '✅ Copied!' : c.code}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: c.type === 'percent' ? '#7C3AED' : '#10B981', lineHeight: 1 }}>
                    {c.type === 'percent' ? `${c.discount}%` : `₹${c.discount}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{c.type === 'percent' ? 'Discount' : 'Flat Off'}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  ['Min Order', `₹${c.minOrder}`],
                  ['Expires', new Date(c.expiry).toLocaleDateString()],
                  ['Used', `${c.used} times`],
                ].map(([label, val], j) => (
                  <div key={j} style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {expired ? <span className="badge badge-cancelled">Expired</span> : <span className={`badge badge-${c.active ? 'active' : 'inactive'}`}>{c.active ? 'Active' : 'Disabled'}</span>}
                <div style={{ flex: 1 }} />
                {!expired && (
                  <button className={`btn btn-xs ${c.active ? 'btn-warning' : 'btn-success'}`} onClick={() => toggle(c._id)}>
                    {c.active ? '⏸ Disable' : '▶ Enable'}
                  </button>
                )}
                <button className="btn btn-xs btn-danger" onClick={() => doDelete(c._id)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎟️ Create New Coupon</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Coupon Code * (uppercase letters)</label>
                <input className="input" placeholder="e.g. FIXON20" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 2, fontWeight: 700 }} />
              </div>
              <div className="form-group">
                <label>Discount Type</label>
                <select className="input select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="percent">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Discount Value *</label>
                <input className="input" type="number" placeholder={form.type === 'percent' ? '10' : '100'} value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Min Order Amount ₹</label>
                <input className="input" type="number" placeholder="300" value={form.minOrder} onChange={e => setForm({ ...form, minOrder: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Expiry Date *</label>
                <input className="input" type="date" value={form.expiry} min={new Date().toISOString().split('T')[0]} onChange={e => setForm({ ...form, expiry: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '⏳ Creating...' : '🎟️ Create Coupon'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
