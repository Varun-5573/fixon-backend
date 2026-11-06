import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const PRODUCTION_URL = 'https://verceltemp-six.vercel.app';
const isDev = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:' ||
  (navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron'))
);
const BASE = isDev ? 'http://localhost:5000' : PRODUCTION_URL;

const PRESET_FESTIVALS = [
  { name: 'Diwali',    emoji: '🪔', color: '#F59E0B' },
  { name: 'Christmas', emoji: '🎄', color: '#10B981' },
  { name: 'New Year',  emoji: '🎉', color: '#7C3AED' },
  { name: 'Sankranti', emoji: '🪁', color: '#F97316' },
  { name: 'Holi',      emoji: '🌈', color: '#EC4899' },
  { name: 'Eid',       emoji: '🌙', color: '#06B6D4' },
  { name: 'Onam',      emoji: '🌸', color: '#84CC16' },
  { name: 'Ugadi',     emoji: '🌿', color: '#14B8A6' },
];

const SWATCH_COLORS = ['#7C3AED','#F59E0B','#10B981','#EC4899','#EF4444','#06B6D4','#F97316','#84CC16'];

const EMPTY_FORM = {
  title: '', festivalName: '', emoji: '🎉', description: '',
  discountText: '', startDate: '', endDate: '', bgColor: '#7C3AED', active: true,
};

export default function FestivalOffersPage({ socket }) {
  const [offers,       setOffers]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);

  /* ── Load ── */
  const load = async () => {
    setLoading(true);
    try {
      const r    = await fetch(`${BASE}/api/admin/festival-offers`, { headers: { 'x-admin-auth': 'true' } });
      const data = await r.json();
      setOffers(data.offers || []);
    } catch { toast.error('Failed to load offers'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* Real-time socket sync */
  useEffect(() => {
    if (!socket) return;
    socket.on('festival_offers_updated', load);
    return () => socket.off('festival_offers_updated', load);
  }, [socket]);

  /* ── Modal helpers ── */
  const openCreate = () => { setEditingOffer(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit   = (o) => {
    setEditingOffer(o);
    setForm({
      title: o.title || '', festivalName: o.festivalName || '', emoji: o.emoji || '🎉',
      description: o.description || '', discountText: o.discountText || '',
      startDate: o.startDate ? o.startDate.slice(0,10) : '',
      endDate:   o.endDate   ? o.endDate.slice(0,10)   : '',
      bgColor: o.bgColor || '#7C3AED', active: o.active !== false,
    });
    setShowModal(true);
  };

  /* ── Save ── */
  const save = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const payload = { ...form, startDate: form.startDate || null, endDate: form.endDate || null };
      const url    = editingOffer ? `${BASE}/api/admin/festival-offers/${editingOffer._id}` : `${BASE}/api/admin/festival-offers`;
      const method = editingOffer ? 'PUT' : 'POST';
      const r    = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'x-admin-auth': 'true' }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (data.success) { toast.success(editingOffer ? 'Offer updated!' : '🎉 Offer created!'); setShowModal(false); load(); }
      else toast.error(data.message || 'Save failed');
    } catch { toast.error('Network error'); }
    setSaving(false);
  };

  /* ── Toggle active ── */
  const toggle = async (o) => {
    try {
      const r    = await fetch(`${BASE}/api/admin/festival-offers/${o._id}/toggle`, { method: 'PATCH', headers: { 'x-admin-auth': 'true' } });
      const data = await r.json();
      if (data.success) {
        toast.success(data.offer.active ? '✅ Activated' : '⏸ Deactivated');
        setOffers(prev => prev.map(x => x._id === o._id ? data.offer : x));
      }
    } catch { toast.error('Toggle failed'); }
  };

  /* ── Delete ── */
  const del = async (o) => {
    if (!window.confirm(`Delete "${o.title}"?`)) return;
    try {
      const r    = await fetch(`${BASE}/api/admin/festival-offers/${o._id}`, { method: 'DELETE', headers: { 'x-admin-auth': 'true' } });
      const data = await r.json();
      if (data.success) { toast.success('Deleted'); setOffers(prev => prev.filter(x => x._id !== o._id)); }
    } catch { toast.error('Delete failed'); }
  };

  /* ── Render ── */
  return (
    <div>
      {/* Page Hero */}
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Festival <span className="gradient-text">Offers</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />Manage seasonal &amp; festival banners shown in customer app</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Offer</button>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        {[
          { label:'Total Offers', value: offers.length,                        icon:'🎉', color:'#7C3AED' },
          { label:'Active Now',   value: offers.filter(o=>o.active).length,    icon:'✅', color:'#10B981' },
          { label:'Inactive',     value: offers.filter(o=>!o.active).length,   icon:'⏸', color:'#F59E0B' },
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{ flex:1, minWidth:150, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:48, height:48, borderRadius:14, background:`${s.color}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:12, color:'var(--text-sub)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, fontSize:36 }}>⏳</div>
      ) : offers.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, background:'var(--card)', borderRadius:20, border:'1px solid var(--border)' }}>
          <div style={{ fontSize:60, marginBottom:16 }}>🎉</div>
          <div style={{ fontSize:18, fontWeight:700 }}>No Festival Offers Yet</div>
          <div style={{ color:'var(--text-sub)', marginTop:8, marginBottom:20 }}>Create your first festival promotional banner</div>
          <button className="btn btn-primary" onClick={openCreate}>+ Create First Offer</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:20 }}>
          {offers.map(o => (
            <div key={o._id} style={{
              borderRadius:20, overflow:'hidden',
              border:`1px solid ${o.active ? o.bgColor+'40' : 'var(--border)'}`,
              opacity: o.active ? 1 : 0.65, transition:'all 0.3s',
              boxShadow: o.active ? `0 8px 32px ${o.bgColor}30` : 'none',
            }}>
              {/* Banner preview */}
              <div style={{ background:`linear-gradient(135deg,${o.bgColor},${o.bgColor}cc)`, padding:'24px 20px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
                <div style={{ position:'absolute', bottom:-30, left:-15, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
                <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative' }}>
                  <div style={{ fontSize:48, lineHeight:1 }}>{o.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{o.festivalName || 'Special Offer'}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:'#fff', lineHeight:1.2 }}>{o.title}</div>
                    {o.discountText && <div style={{ marginTop:8, display:'inline-block', background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'3px 12px', fontSize:13, fontWeight:700, color:'#fff' }}>{o.discountText}</div>}
                    {o.description  && <div style={{ marginTop:6, fontSize:12, color:'rgba(255,255,255,0.8)', lineHeight:1.4 }}>{o.description}</div>}
                  </div>
                  <span style={{ background: o.active ? 'rgba(16,185,129,0.9)':'rgba(107,114,128,0.9)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' }}>
                    {o.active ? '● LIVE' : '⏸ OFF'}
                  </span>
                </div>
              </div>
              {/* Actions */}
              <div style={{ background:'var(--card)', padding:'14px 16px' }}>
                <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--text-sub)', marginBottom:12 }}>
                  {o.startDate && <span>📅 From: {new Date(o.startDate).toLocaleDateString()}</span>}
                  {o.endDate   && <span>⏰ Until: {new Date(o.endDate).toLocaleDateString()}</span>}
                  {!o.startDate && !o.endDate && <span>📅 Always active (no date limit)</span>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-sm btn-secondary" style={{ flex:1 }} onClick={() => openEdit(o)}>✏️ Edit</button>
                  <button className={`btn btn-sm ${o.active ? 'btn-secondary':'btn-primary'}`} style={{ flex:1 }} onClick={() => toggle(o)}>
                    {o.active ? '⏸ Deactivate' : '▶ Activate'}
                  </button>
                  <button className="btn btn-sm" style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444430' }} onClick={() => del(o)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--card)', borderRadius:24, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', border:'1px solid var(--border)', boxShadow:'0 40px 80px rgba(0,0,0,0.6)' }}>
            {/* Header */}
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800 }}>{editingOffer ? '✏️ Edit Offer' : '🎉 Create Festival Offer'}</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ padding:'20px 24px' }}>
              {/* Presets */}
              {!editingOffer && (
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:'var(--text-sub)', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:10 }}>Quick Presets</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {PRESET_FESTIVALS.map(p => (
                      <button key={p.name} className="btn btn-sm btn-secondary"
                        style={{ background:`${p.color}20`, borderColor:`${p.color}40`, color:p.color }}
                        onClick={() => setForm(f => ({ ...f, festivalName:p.name, emoji:p.emoji, bgColor:p.color }))}>
                        {p.emoji} {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Preview */}
              <div style={{ marginBottom:20, borderRadius:16, overflow:'hidden', border:'1px solid var(--border)' }}>
                <div style={{ background:`linear-gradient(135deg,${form.bgColor},${form.bgColor}cc)`, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ fontSize:40 }}>{form.emoji}</div>
                  <div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:700, textTransform:'uppercase' }}>{form.festivalName || 'Festival'}</div>
                    <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>{form.title || 'Your Offer Title'}</div>
                    {form.discountText && <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)', marginTop:4 }}>{form.discountText}</div>}
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label className="form-label">Festival Name *</label>
                    <input className="input" placeholder="e.g. Diwali" value={form.festivalName} onChange={e => setForm(f => ({...f, festivalName:e.target.value}))} />
                  </div>
                  <div>
                    <label className="form-label">Emoji</label>
                    <input className="input" placeholder="🎉" value={form.emoji} onChange={e => setForm(f => ({...f, emoji:e.target.value}))} />
                  </div>
                </div>

                <div>
                  <label className="form-label">Banner Title *</label>
                  <input className="input" placeholder="e.g. Diwali Special – AC Service at 40% OFF!" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
                </div>

                <div>
                  <label className="form-label">Discount Badge Text</label>
                  <input className="input" placeholder="e.g. Flat 40% OFF" value={form.discountText} onChange={e => setForm(f => ({...f, discountText:e.target.value}))} />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <textarea className="input" rows={3} placeholder="Short description..." value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} style={{ resize:'vertical' }} />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label className="form-label">Start Date (optional)</label>
                    <input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate:e.target.value}))} />
                  </div>
                  <div>
                    <label className="form-label">End Date (optional)</label>
                    <input className="input" type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate:e.target.value}))} />
                  </div>
                </div>

                <div>
                  <label className="form-label">Banner Color</label>
                  <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                    <input type="color" value={form.bgColor} onChange={e => setForm(f => ({...f, bgColor:e.target.value}))}
                      style={{ width:48, height:40, border:'none', borderRadius:8, cursor:'pointer', background:'none' }} />
                    <input className="input" value={form.bgColor} onChange={e => setForm(f => ({...f, bgColor:e.target.value}))} style={{ flex:1, minWidth:100 }} />
                    <div style={{ display:'flex', gap:6 }}>
                      {SWATCH_COLORS.map(c => (
                        <div key={c} onClick={() => setForm(f => ({...f, bgColor:c}))}
                          style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer',
                            border: form.bgColor===c ? '3px solid white' : '2px solid transparent',
                            boxShadow: form.bgColor===c ? `0 0 0 2px ${c}` : 'none' }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active toggle */}
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div onClick={() => setForm(f => ({...f, active:!f.active}))}
                    style={{ width:44, height:24, borderRadius:12, background: form.active ? '#10B981':'var(--border)', transition:'background 0.2s', position:'relative', cursor:'pointer', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:2, left: form.active ? 22:2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
                  </div>
                  <span style={{ fontWeight:600 }}>{form.active ? '✅ Active – visible in customer app' : '⏸ Inactive – hidden from app'}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', gap:12, justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? '⏳ Saving...' : editingOffer ? '💾 Update Offer' : '🎉 Create Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
