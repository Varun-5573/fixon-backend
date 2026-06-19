import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const SERVICES = ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'AC Repair', 'Pest Control'];
const CITIES = ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam', 'Nalgonda', 'Suryapet'];

const emptyWorker = { name: '', phone: '', email: '', address: '', city: 'Hyderabad', category: '', skills: [], aadhaar: '', pan: '', isAvailable: true, isActive: true };

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyWorker);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('All');
  const [saving, setSaving] = useState(false);
  const [payoutModal, setPayoutModal] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [payoutTab, setPayoutTab] = useState('payouts');
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [credModal, setCredModal] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const r = await adminApi.getWorkers(); setWorkers(r.workers || r || []); }
    catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  const openAdd = () => { setForm(emptyWorker); setModal('add'); };
  const openEdit = (w) => { setForm({ ...w, city: w.city || 'Hyderabad', skills: Array.isArray(w.skills) ? w.skills : [] }); setModal('edit'); };

  const viewPayouts = async (w) => {
    setPayoutModal(w);
    setPayoutTab('payouts');
    setLoadingPayouts(true);
    setPayouts(null);
    setRatings([]);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`http://localhost:5000/api/workers/${w._id}/payouts`).then(r => r.json()),
        fetch(`http://localhost:5000/api/ratings/worker/${w._id}`).then(r => r.json()),
      ]);
      if (pRes.success) setPayouts(pRes);
      else toast.error('Could not fetch payouts');
      if (rRes.success) setRatings(rRes.ratings || []);
    } catch {
      toast.error('Error connecting to local server');
    }
    setLoadingPayouts(false);
  };

  const exportPayoutCSV = () => {
    if (!payouts) return;
    const rows = ['Job ID,Service,Total Price,Worker Earning,Date',
      ...payouts.bookings.map(b =>
        `${b._id},${b.service},${b.price},${b.workerEarning},${new Date(b.date).toLocaleDateString('en-IN')}`)
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payout_${payoutModal.name.replace(/\s+/g, '_')}.csv`;
    a.click();
  };

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

  const filtered = workers.filter(w => {
    const matchSearch =
      w.name?.toLowerCase().includes(search.toLowerCase()) ||
      w.category?.toLowerCase().includes(search.toLowerCase()) ||
      w.city?.toLowerCase().includes(search.toLowerCase()) ||
      w.phone?.includes(search);
    const matchCity = cityFilter === 'All' || (w.city || 'Hyderabad') === cityFilter;
    return matchSearch && matchCity;
  });

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Worker <span className="gradient-text">Management</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{workers.length} total workers · {cityFilter !== 'All' ? `${filtered.length} in ${cityFilter}` : 'All cities'}</div>
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
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              className="input select"
              style={{ width: 160, height: 38, fontSize: 13 }}
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
            >
              <option value="All">🗺️ All Cities</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="search-bar" style={{ width: 240 }}>
              <span className="search-icon">🔍</span>
              <input className="input" placeholder="Search name, phone, category..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Worker</th><th>Phone</th><th>City</th><th>Service</th><th>Rating</th><th>Availability</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? Array(3).fill(0).map((_, i) => <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 40 }} /></td></tr>) :
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
                  <td style={{ fontWeight: 600, color: '#06B6D4' }}>{w.city || 'Hyderabad'}</td>
                  <td><span className="badge badge-accepted">{w.category || w.skills?.[0] || '—'}</span></td>
                  <td>
                    <span style={{ color: '#F59E0B', fontWeight: 700 }}>⭐ {(w.rating || 4.2)}</span>
                  </td>
                  <td>
                    <span className={`status-dot ${w.isAvailable ? 'online' : 'busy'}`} style={{ marginRight: 6 }} />
                    {w.isAvailable ? 'Available' : 'Busy'}
                  </td>
                  <td><span className={`badge badge-${w.isActive ? 'active' : 'inactive'}`}>{w.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-xs btn-secondary" onClick={() => openEdit(w)}>✏️ Edit</button>
                      <button className="btn btn-xs btn-primary" onClick={() => viewPayouts(w)}>💰 Payout</button>
                       {w.workerId && (
                         <button className="btn btn-xs" style={{ background: '#7C3AED', color: 'white' }} onClick={() => setCredModal(w)}>🔑 Creds</button>
                       )}
                      <button className={`btn btn-xs ${w.isActive ? 'btn-warning' : 'btn-success'}`} onClick={() => toggle(w._id)}>
                        {w.isActive ? '⏸ Deactivate' : '▶ Activate'}
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => doDelete(w._id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>No workers found</td></tr>}
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
                  <option>Plumbing</option><option>Electrical</option><option>Cleaning</option><option>AC Repair</option><option>Carpentry</option><option>Painting</option><option>Pest Control</option>
                </select>
              </div>
              <div className="form-group">
                <label>City *</label>
                <select className="input select" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Address</label>
                <input className="input" placeholder="Full address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Aadhaar Number</label>
                <input className="input" placeholder="12-digit Aadhaar" maxLength={12} value={form.aadhaar || ''} onChange={e => setForm({ ...form, aadhaar: e.target.value.replace(/\D/g,'') })} />
              </div>
              <div className="form-group">
                <label>PAN Card Number</label>
                <input className="input" placeholder="e.g. ABCDE1234F" maxLength={10} style={{ textTransform: 'uppercase' }} value={form.pan || ''} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
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

      {/* Payout + Ratings Modal */}
      {payoutModal && (
        <div className="modal-overlay" onClick={() => { setPayoutModal(null); setPayouts(null); setRatings([]); }}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>👷 {payoutModal.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                  {payoutModal.category} · {payoutModal.city || 'Hyderabad'} · ⭐ {payoutModal.rating || 'N/A'}
                </div>
              </div>
              <button className="modal-close" onClick={() => { setPayoutModal(null); setPayouts(null); setRatings([]); }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              {[
                { key: 'payouts', label: '💰 Payouts' },
                { key: 'ratings', label: `⭐ Ratings (${ratings.length})` },
              ].map(tab => (
                <button key={tab.key} onClick={() => setPayoutTab(tab.key)}
                  style={{
                    padding: '10px 22px', fontWeight: 700, fontSize: 13,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: payoutTab === tab.key ? '#7C3AED' : 'var(--text-sub)',
                    borderBottom: payoutTab === tab.key ? '2px solid #7C3AED' : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >{tab.label}</button>
              ))}
            </div>

            {loadingPayouts ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <span className="loading-spinner" /> Loading data...
              </div>
            ) : payoutTab === 'payouts' ? (
              payouts ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Total Jobs', value: payouts.totalJobs, color: '#7C3AED' },
                      { label: 'Avg / Job', value: `₹${payouts.averagePerJob || 0}`, color: '#06B6D4' },
                      { label: 'Worker Earnings', value: `₹${payouts.totalEarnings}`, color: '#10B981' },
                      { label: 'Platform Cut', value: `₹${payouts.platformCut}`, color: '#F59E0B' },
                    ].map((s, i) => (
                      <div key={i} style={{ padding: 12, borderRadius: 10, background: `${s.color}0f`, border: `1px solid ${s.color}33`, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ margin: 0 }}>Job History</h4>
                    <button className="btn btn-xs btn-secondary" onClick={exportPayoutCSV}>📥 Export CSV</button>
                  </div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr><th>Job ID</th><th>Service</th><th>Price</th><th>Earning</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {payouts.bookings.map((b, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b._id?.slice(-8)}</td>
                            <td>{b.service}</td>
                            <td>₹{b.price}</td>
                            <td style={{ color: '#10B981', fontWeight: 600 }}>₹{b.workerEarning}</td>
                            <td style={{ fontSize: 11, color: 'var(--text-sub)' }}>{new Date(b.date).toLocaleDateString('en-IN')}</td>
                          </tr>
                        ))}
                        {payouts.bookings.length === 0 && (
                          <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-sub)', padding: 24 }}>No completed jobs yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-sub)' }}>No payout records found.</div>
              )
            ) : (
              /* ── Ratings Tab ─────────────────────────────── */
              ratings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-sub)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>No ratings yet</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>Ratings appear after customers complete bookings and submit feedback.</div>
                </div>
              ) : (
                <div>
                  {/* Average score banner */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, padding: 18, borderRadius: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ fontSize: 52, fontWeight: 900, color: '#F59E0B', lineHeight: 1 }}>
                      {(ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                        {[1,2,3,4,5].map(s => (
                          <span key={s} style={{ color: s <= Math.round(ratings.reduce((a,r) => a+r.rating,0) / ratings.length) ? '#F59E0B' : 'var(--border)', fontSize: 22 }}>★</span>
                        ))}
                      </div>
                      <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>
                        Based on {ratings.length} customer review{ratings.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  {/* Review list */}
                  <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ratings.map((r, i) => (
                      <div key={i} style={{ padding: 14, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1,2,3,4,5].map(s => (
                              <span key={s} style={{ color: s <= r.rating ? '#F59E0B' : 'var(--border)', fontSize: 15 }}>★</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                            {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        {r.comment && (
                          <div style={{ fontSize: 13, color: 'var(--text-sub)', fontStyle: 'italic', marginBottom: 4 }}>"{r.comment}"</div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Booking #{r.bookingId?.slice(-8)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            <div style={{ display: 'flex', marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setPayoutModal(null); setPayouts(null); setRatings([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {credModal && (
        <div className="modal-overlay" onClick={() => setCredModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔑 Worker App Credentials</h3>
              <button className="modal-close" onClick={() => setCredModal(null)}>✕</button>
            </div>
            <div style={{ padding: '8px 0' }}>
              <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div className="admin-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>{(credModal.name || 'W')[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{credModal.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{credModal.category} · {credModal.city || 'Hyderabad'}</div>
                  </div>
                </div>
                {[['📱 Worker App ID', credModal.workerId], ['🔒 Password', credModal.workerPassword]].map(([label, val]) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <code style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 15, fontWeight: 800, letterSpacing: 1, color: '#7C3AED' }}>{val || '—'}</code>
                      <button className="btn btn-xs btn-secondary" onClick={() => { navigator.clipboard.writeText(val || ''); toast.success('Copied!'); }}>📋 Copy</button>
                    </div>
                  </div>
                ))}
                {credModal.aadhaar && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-sub)' }}>
                    <span style={{ marginRight: 12 }}>🪪 Aadhaar: <b>{credModal.aadhaar}</b></span>
                    {credModal.pan && <span>📄 PAN: <b>{credModal.pan}</b></span>}
                  </div>
                )}
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#10B981' }}>
                ℹ️ Share these credentials with <b>{credModal.name}</b> to log in to the <b>FixoN Worker App</b>.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setCredModal(null)}>Close</button>
              <button className="btn btn-primary" style={{ background: '#7C3AED' }} onClick={() => {
                const msg = `FixoN Worker App Login\nID: ${credModal.workerId}\nPassword: ${credModal.workerPassword}\nDownload the Worker App and login with these credentials.`;
                navigator.clipboard.writeText(msg);
                toast.success('Full credentials copied to clipboard!');
              }}>📋 Copy All & Share</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
