import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const SERVICES = ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'AC Repair', 'Pest Control'];

const emptyWorker = { name: '', phone: '', email: '', address: '', category: '', skills: [], isAvailable: true, isActive: true };

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyWorker);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const r = await adminApi.getWorkers(); setWorkers(r.workers || r || []); }
    catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  const openAdd = () => { setForm(emptyWorker); setModal('add'); };
  const openEdit = (w) => { setForm({ ...w, skills: Array.isArray(w.skills) ? w.skills : [] }); setModal('edit'); };

  const save = async () => {
    if (!form.name || !form.phone || !form.category) return toast.error('Fill required fields');
    setSaving(true);
    try {
      if (modal === 'add') await adminApi.addWorker(form);
      else await adminApi.updateWorker(form._id, form);
      toast.success(modal === 'add' ? 'Worker added! 🎉' : 'Worker updated!');
      setModal(null); load();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const doDelete = async (id) => {
    if (!window.confirm('Delete this worker?')) return;
    try { await adminApi.deleteWorker(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const toggle = async (id) => {
    try { await adminApi.toggleWorker(id); toast.success('Status updated'); load(); } catch { toast.error('Failed'); }
  };

  const toggleSkill = (s) => {
    setForm(f => ({ ...f, skills: f.skills?.includes(s) ? f.skills.filter(x => x !== s) : [...(f.skills || []), s] }));
  };

  const filtered = workers.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.category?.toLowerCase().includes(search.toLowerCase()) ||
    w.phone?.includes(search)
  );

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Worker <span className="gradient-text">Management</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{workers.length} total workers</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>🔄 Refresh</button>
          <button id="add-worker-btn" className="btn btn-primary btn-sm" onClick={openAdd}>➕ Add Worker</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Workers', value: workers.length, icon: '👷', color: '#7C3AED' },
          { label: 'Available', value: workers.filter(w => w.isAvailable).length, icon: '🟢', color: '#10B981' },
          { label: 'Busy', value: workers.filter(w => !w.isAvailable && w.isActive).length, icon: '🟡', color: '#F59E0B' },
          { label: 'Inactive', value: workers.filter(w => !w.isActive).length, icon: '🔴', color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header">
          <h3>All Workers</h3>
          <div className="search-bar" style={{ width: 260 }}>
            <span className="search-icon">🔍</span>
            <input className="input" placeholder="Search workers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Worker</th><th>Phone</th><th>Service</th><th>Rating</th><th>Availability</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan={8}><div className="skeleton" style={{ height: 40 }} /></td></tr>) :
              filtered.map((w, i) => (
                <tr key={w._id} className="fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <td style={{ color: 'var(--text-sub)', fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="admin-avatar" style={{ width: 38, height: 38, fontSize: 14 }}>{(w.name || 'W')[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{w.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-sub)' }}>{w.phone}</td>
                  <td><span className="badge badge-accepted">{w.category || w.skills?.[0] || '—'}</span></td>
                  <td>
                    <span style={{ color: '#F59E0B', fontWeight: 700 }}>⭐ {(w.rating || 4.2).toFixed(1)}</span>
                  </td>
                  <td>
                    <span className={`status-dot ${w.isAvailable ? 'online' : 'busy'}`} style={{ marginRight: 6 }} />
                    {w.isAvailable ? 'Available' : 'Busy'}
                  </td>
                  <td><span className={`badge badge-${w.isActive ? 'active' : 'inactive'}`}>{w.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-xs btn-secondary" onClick={() => openEdit(w)}>✏️ Edit</button>
                      <button className={`btn btn-xs ${w.isActive ? 'btn-warning' : 'btn-success'}`} onClick={() => toggle(w._id)}>
                        {w.isActive ? '⏸ Deactivate' : '▶ Activate'}
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => doDelete(w._id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>No workers found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? '➕ Add Worker' : '✏️ Edit Worker'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label>Full Name *</label>
                <input className="input" placeholder="Worker name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input className="input" placeholder="10-digit number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select className="input select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select category</option>
                  <option>Maintenance</option><option>Home Services</option><option>Electrical</option><option>Cleaning</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Address</label>
                <input className="input" placeholder="Full address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Skills</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SERVICES.map(s => (
                    <button key={s} type="button"
                      className={`btn btn-xs ${(form.skills || []).includes(s) ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleSkill(s)}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? '⏳ Saving...' : `${modal === 'add' ? '➕ Add' : '✅ Update'} Worker`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
