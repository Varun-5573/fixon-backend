import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const DEFAULT_SERVICES = [
  { _id: '1', name: 'Plumbing', icon: '🔧', category: 'Maintenance', price: 499, description: 'Pipe repairs, leak fixing, installation', active: true, bookings: 47 },
  { _id: '2', name: 'Electrical', icon: '⚡', category: 'Maintenance', price: 599, description: 'Wiring, switch repair, fan installation', active: true, bookings: 38 },
  { _id: '3', name: 'Deep Cleaning', icon: '🧹', category: 'Cleaning', price: 1299, description: 'Full home deep cleaning service', active: true, bookings: 55 },
  { _id: '4', name: 'AC Repair', icon: '❄️', category: 'Appliances', price: 799, description: 'AC servicing, gas refill, repair', active: true, bookings: 61 },
  { _id: '5', name: 'Carpentry', icon: '🪚', category: 'Maintenance', price: 699, description: 'Furniture repair & wood work', active: true, bookings: 28 },
  { _id: '6', name: 'Painting', icon: '🎨', category: 'Home Improvement', price: 2499, description: 'Interior & exterior painting', active: false, bookings: 23 },
  { _id: '7', name: 'Pest Control', icon: '🐛', category: 'Cleaning', price: 999, description: 'Cockroach, rat & insect removal', active: true, bookings: 19 },
  { _id: '8', name: 'CCTV Installation', icon: '📹', category: 'Security', price: 3499, description: 'Security camera setup & wiring', active: true, bookings: 14 },
];

const empty = { name: '', icon: '🔧', category: '', price: '', description: '', active: true };

export default function ServicesPage() {
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try { const r = await adminApi.getServices(); if (r?.services?.length) setServices(r.services); }
      catch {}
    })();
  }, []);

  const openAdd = () => { setForm(empty); setModal('add'); };
  const openEdit = (s) => { setForm({ ...s }); setModal('edit'); };

  const save = async () => {
    if (!form.name || !form.price || !form.category) return toast.error('Fill all required fields');
    setSaving(true);
    try {
      if (modal === 'add') {
        const newSvc = { ...form, _id: Date.now().toString(), bookings: 0 };
        setServices(p => [...p, newSvc]);
        try { await adminApi.addService(form); } catch {}
        toast.success('Service added! 🎉');
      } else {
        setServices(p => p.map(s => s._id === form._id ? { ...s, ...form } : s));
        try { await adminApi.updateService(form._id, form); } catch {}
        toast.success('Service updated!');
      }
      setModal(null);
    } catch {}
    setSaving(false);
  };

  const toggleActive = async (id) => {
    setServices(p => p.map(s => s._id === id ? { ...s, active: !s.active } : s));
    try { await adminApi.updateService(id, {}); } catch {}
    toast.success('Status updated');
  };

  const doDelete = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    setServices(p => p.filter(s => s._id !== id));
    try { await adminApi.deleteService(id); } catch {}
    toast.success('Service deleted');
  };

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase()));

  const ICONS = ['🔧', '⚡', '🧹', '❄️', '🪚', '🎨', '🐛', '📹', '🏠', '🛁', '🪣', '🔌', '💡', '🪟'];

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Service <span className="gradient-text">Management</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{services.length} services configured</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="search-bar" style={{ width: 220 }}>
            <span className="search-icon">🔍</span>
            <input className="input" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ Add Service</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Services', value: services.length, icon: '🛠️', color: '#7C3AED' },
          { label: 'Active', value: services.filter(s => s.active).length, icon: '✅', color: '#10B981' },
          { label: 'Inactive', value: services.filter(s => !s.active).length, icon: '⏸', color: '#EF4444' },
          { label: 'Total Bookings', value: services.reduce((a, s) => a + (s.bookings || 0), 0), icon: '📦', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Services Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
        {filtered.map((s, i) => (
          <div key={s._id} className="service-card fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="service-icon-wrap">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>{s.category}</div>
                </div>
              </div>
              <span className={`badge badge-${s.active ? 'active' : 'inactive'}`}>{s.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 14, lineHeight: 1.5 }}>{s.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>Starting Price</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>₹{s.price}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>Bookings</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-light)' }}>{s.bookings}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(s)}>✏️ Edit</button>
                <button className={`btn btn-sm ${s.active ? 'btn-warning' : 'btn-success'}`} style={{ flex: 1 }} onClick={() => toggleActive(s._id)}>
                  {s.active ? '⏸ Disable' : '▶ Enable'}
                </button>
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => doDelete(s._id)}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? '➕ Add New Service' : '✏️ Edit Service'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>Service Name *</label>
                  <input className="input" placeholder="e.g. Plumbing Repair" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select className="input select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="">Select...</option>
                    {['Maintenance', 'Cleaning', 'Appliances', 'Home Improvement', 'Security'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Starting Price ₹ *</label>
                  <input className="input" type="number" placeholder="499" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Icon</label>
                  <select className="input select" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}>
                    {ICONS.map(ic => <option key={ic} value={ic}>{ic} {ic}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="input" rows={3} placeholder="Service description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="svc-active" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 16, height: 16 }} />
                <label htmlFor="svc-active" style={{ margin: 0, textTransform: 'none', fontSize: 13 }}>Active (visible to customers)</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '⏳ Saving...' : modal === 'add' ? '➕ Add Service' : '✅ Update Service'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
