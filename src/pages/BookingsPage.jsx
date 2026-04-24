import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const STATUS_COLORS = { pending: '#F59E0B', accepted: '#7C3AED', ongoing: '#06B6D4', completed: '#10B981', cancelled: '#EF4444' };

export default function BookingsPage({ socket, onNavigateToMap }) {
  const [bookings, setBookings] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [confirming, setConfirming] = useState(null);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (socket) {
      socket.on('new_booking', (b) => {
        toast.success(`📦 New booking: ${b.service}`, { duration: 5000 });
        load();
      });
      socket.on('booking_update', () => load());
    }
    return () => { socket?.off('new_booking'); socket?.off('booking_update'); };
  }, [socket]);

  const load = async () => {
    try {
      const [bRes, wRes] = await Promise.all([adminApi.getBookings(), adminApi.getWorkers()]);
      setBookings(bRes.bookings || bRes || []);
      setWorkers(wRes.workers || wRes || []);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    try { await adminApi.updateBooking(id, { status }); toast.success(`Status → ${status}`); load(); } catch { toast.error('Failed'); }
  };

  // 🔑 Confirm Booking → changes status to 'accepted' → auto opens map
  const confirmBooking = async (booking) => {
    setConfirming(booking._id);
    try {
      const worker = workers.find(w => w._id === selectedWorker) || null;
      await adminApi.confirmBooking(booking._id, worker?._id, worker?.name);
      toast.success(`✅ Booking confirmed for ${booking.userId?.name}!`, { duration: 4000 });
      load();

      // Auto-open map to customer's location after a short delay
      setTimeout(() => {
        const bookedLat = booking.location?.lat || booking.userId?.location?.lat;
        const bookedLng = booking.location?.lng || booking.userId?.location?.lng;
        if (bookedLat && onNavigateToMap) {
          toast('🗺️ Opening map to customer location...', { icon: '📍' });
          onNavigateToMap({ ...booking, _autoFocus: true });
        }
      }, 800);
    } catch { toast.error('Confirm failed'); }
    setConfirming(null);
    setAssignModal(null);
  };

  const doAssign = async () => {
    if (!selectedWorker) return toast.error('Select a worker');
    try { await adminApi.assignWorker(assignModal._id, selectedWorker); toast.success('Worker assigned! 🎉'); setAssignModal(null); load(); } catch { toast.error('Failed'); }
  };

  const filtered = bookings.filter(b => {
    const matchSearch = b.service?.toLowerCase().includes(search.toLowerCase()) || b.userId?.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || b.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Booking <span className="gradient-text">Management</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{bookings.length} total bookings • Live updates enabled</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['all', 'pending', 'accepted', 'ongoing', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}>
            {s === 'all' ? `All (${bookings.length})` : `${s} (${bookings.filter(b => b.status === s).length})`}
          </button>
        ))}
        <div className="search-bar" style={{ width: 220, marginLeft: 'auto' }}>
          <span className="search-icon">🔍</span>
          <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h3>Bookings ({filtered.length})</h3>
          <span className="badge badge-active"><span className="live-dot" style={{ marginRight: 4 }} />Real-time</span>
        </div>
        <table>
          <thead><tr><th>#</th><th>Customer</th><th>Service</th><th>Location</th><th>Worker</th><th>Date & Time</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? Array(4).fill(0).map((_, i) => <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 42 }} /></td></tr>) :
              filtered.map((b, i) => (
                <tr key={b._id} className="fade-in" style={{ animationDelay: `${i * 40}ms`, background: b.status === 'pending' ? 'rgba(245,158,11,0.03)' : undefined }}>
                  <td style={{ fontSize: 11, color: 'var(--text-sub)' }}>{String(b._id).slice(-5)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{(b.userId?.name || 'C')[0]}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{b.userId?.name || 'Customer'}</div>
                        {b.userId?.email && <div style={{ fontSize: 10, color: 'var(--text-sub)' }}>{b.userId.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.service}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{b.category || ''}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {b.location?.address ? (
                      <div>
                        <div style={{ color: 'var(--text-sub)', fontSize: 11 }} title={b.location.address}>
                          📍 {b.location.address.slice(0, 22)}{b.location.address.length > 22 ? '…' : ''}
                        </div>
                        {b.location?.lat && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{b.location.lat?.toFixed(4)}, {b.location.lng?.toFixed(4)}</div>}
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ color: b.workerId ? 'var(--text)' : 'var(--text-dim)', fontSize: 13 }}>
                    {b.workerId?.name || '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                    {new Date(b.scheduledTime || b.createdAt || Date.now()).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 700, color: '#10B981' }}>₹{b.price || 0}</td>
                  <td>
                    <span className={`badge badge-${b.status}`}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[b.status], marginRight: 4 }} />
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {/* View detail */}
                      <button className="btn btn-xs btn-secondary" title="View details" onClick={() => setSelected(b)}>👁</button>

                      {/* 🔑 CONFIRM BOOKING (pending only) */}
                      {b.status === 'pending' && (
                        <button
                          className="btn btn-xs btn-success"
                          title="Confirm Booking + Open Map"
                          style={{ background: 'linear-gradient(135deg,#10B981,#059669)', fontWeight: 700 }}
                          disabled={confirming === b._id}
                          onClick={() => { setAssignModal(b); setSelectedWorker(''); }}
                        >
                          {confirming === b._id ? '⏳' : '✅ Confirm'}
                        </button>
                      )}

                      {/* Assign worker */}
                      <button className="btn btn-xs btn-secondary" title="Assign worker" onClick={() => { setAssignModal(b); setSelectedWorker(''); }}>👷</button>

                      {/* Open Map */}
                      {(b.location?.lat || b.userId?.location?.lat) && (
                        <button className="btn btn-xs btn-primary" title="View on map" onClick={() => onNavigateToMap && onNavigateToMap(b)}>🗺️</button>
                      )}

                      {b.status === 'accepted' && <button className="btn btn-xs btn-secondary" onClick={() => updateStatus(b._id, 'ongoing')}>▶ Start</button>}
                      {b.status === 'ongoing' && <button className="btn btn-xs btn-success" onClick={() => updateStatus(b._id, 'completed')}>✔ Done</button>}
                      {!['completed', 'cancelled'].includes(b.status) && <button className="btn btn-xs btn-danger" onClick={() => updateStatus(b._id, 'cancelled')}>✕</button>}
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>No bookings found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Detail Modal ─────────────────────────── */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>📦 Booking Details</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Service', selected.service],
                ['Customer', selected.userId?.name || 'N/A'],
                ['Worker', selected.workerId?.name || 'Not assigned'],
                ['Price', `₹${selected.price || 0}`],
                ['Status', selected.status],
                ['Date', new Date(selected.scheduledTime || selected.createdAt || Date.now()).toLocaleString()],
                ['Address', selected.location?.address || 'Not provided'],
                ['Category', selected.category || 'N/A'],
                ['Lat', selected.location?.lat || '—'],
                ['Lng', selected.location?.lng || '—'],
              ].map(([label, val], i) => (
                <div key={i} style={{ padding: 12, borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 3, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{val}</div>
                </div>
              ))}
            </div>
            {(selected.location?.lat || selected.userId?.location?.lat) && (
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setSelected(null); onNavigateToMap && onNavigateToMap(selected); }}>
                  🗺️ View on Live Map
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm + Assign Modal ───────────────── */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Confirm Booking</h3>
              <button className="modal-close" onClick={() => setAssignModal(null)}>✕</button>
            </div>

            {/* Booking summary */}
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>Service</div>
                  <div style={{ fontWeight: 700 }}>{assignModal.service}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>Customer</div>
                  <div style={{ fontWeight: 700 }}>{assignModal.userId?.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>Price</div>
                  <div style={{ fontWeight: 700, color: '#10B981' }}>₹{assignModal.price}</div>
                </div>
              </div>
              {assignModal.location?.address && (
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>
                  📍 {assignModal.location.address}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Assign Worker (optional)</label>
              <select className="input select" value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)}>
                <option value="">Auto-assign later...</option>
                {workers.filter(w => w.isAvailable && w.isActive).map(w => (
                  <option key={w._id} value={w._id}>{w.name} — {w.category || w.skills?.[0]} ⭐{(w.rating || 4.2).toFixed(1)}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAssignModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, background: 'linear-gradient(135deg,#10B981,#059669)' }}
                disabled={confirming === assignModal._id}
                onClick={() => confirmBooking(assignModal)}
              >
                {confirming === assignModal._id ? '⏳ Confirming...' : '✅ Confirm & Open Map'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
