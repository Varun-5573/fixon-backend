import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: '⏳' },
  accepted:   { label: 'Confirmed',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', icon: '✅' },
  on_the_way: { label: 'On The Way', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', icon: '🏍️' },
  arrived:    { label: 'Arrived',    color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)', icon: '📍' },
  ongoing:    { label: 'In Progress', color: '#EC4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)', icon: '🛠️' },
  completed:  { label: 'Completed',  color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: '🎉' },
  cancelled:  { label: 'Cancelled',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  icon: '❌' },
};

export default function BookingsPage({ socket, onNavigateToMap }) {
  const [bookings, setBookings] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
  
  const [selected, setSelected] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (socket) {
      const handleNewBooking = (b) => {
        setBookings(prev => {
          const exists = prev.find(x => x._id === b._id);
          if (exists) return prev.map(x => x._id === b._id ? b : x);
          return [b, ...prev];
        });
        toast.success(`📦 New booking: ${b.service} by ${b.userId?.name || b.userName || 'Customer'}`, { duration: 5000 });
      };

      const ranks = {
        pending: 0, assigned: 1, accepted: 2, confirmed: 2,
        on_the_way: 3, arrived: 4, ongoing: 5, in_progress: 5, started: 5,
        completed: 6, cancelled: 99
      };
      const norm = (s) => {
        if (!s) return 'pending';
        const str = String(s).trim().toLowerCase().replace(/[\s-]/g, '_');
        if (['confirmed', 'accepted', 'accept'].includes(str)) return 'accepted';
        if (['on_the_way', 'ontheway', 'on_way', 'on-the-way'].includes(str)) return 'on_the_way';
        if (['arrived', 'arrive'].includes(str)) return 'arrived';
        if (['ongoing', 'in_progress', 'start_work', 'started', 'start', 'working'].includes(str)) return 'ongoing';
        if (['completed', 'complete', 'finish', 'finished', 'done'].includes(str)) return 'completed';
        if (['cancelled', 'cancel'].includes(str)) return 'cancelled';
        return str;
      };

      const handleBookingUpdate = (data) => {
        if (data?.bookingId && data?.booking) {
          setBookings(prev => prev.map(b => {
            if (b._id !== data.bookingId) return b;
            const currentRank = ranks[norm(b.status)] ?? 0;
            const incomingRank = ranks[norm(data.booking.status)] ?? 0;
            if (incomingRank < currentRank && norm(data.booking.status) !== 'cancelled') {
              return b; // ignore stale event
            }
            return data.booking;
          }));
        } else {
          load();
        }
      };

      socket.on('new_booking', handleNewBooking);
      socket.on('booking_update', handleBookingUpdate);

      return () => {
        socket.off('new_booking', handleNewBooking);
        socket.off('booking_update', handleBookingUpdate);
      };
    }
  }, [socket]);

  const load = async () => {
    try {
      const [bRes, wRes] = await Promise.all([adminApi.getBookings(), adminApi.getWorkers()]);
      setBookings(bRes.bookings || bRes || []);
      setWorkers(wRes.workers || wRes || []);
    } catch { 
      toast.error('Failed to load live data'); 
    }
    setLoading(false);
  };

  const viewInvoice = async (bookingId) => {
    try {
      const data = await adminApi.getInvoice(bookingId);
      if (data && data.success && data.invoice) {
        setInvoiceData(data.invoice);
        setInvoiceModal(true);
      } else {
        toast.error('Failed to load invoice');
      }
    } catch {
      toast.error('Connection error — is server running?');
    }
  };

  const updateStatus = async (id, status) => {
    // Optimistic Update
    setBookings(prev => prev.map(b => b._id === id ? { ...b, status } : b));
    if (selected && selected._id === id) {
      setSelected(prev => ({ ...prev, status }));
    }
    try {
      await adminApi.updateBooking(id, { status });
      toast.success(`Status updated → ${STATUS_CONFIG[status]?.label || status}`);
      load();
    } catch {
      toast.error('Failed to update status');
      load();
    }
  };

  // Confirm Booking (Pending -> Accepted)
  const confirmBooking = async (booking) => {
    setConfirming(booking._id);
    const worker = workers.find(w => w._id === selectedWorker) || null;
    
    // Optimistic local update
    setBookings(prev => prev.map(b => b._id === booking._id ? {
      ...b,
      status: 'accepted',
      workerId: worker || b.workerId,
      workerName: worker?.name || b.workerName
    } : b));

    try {
      await adminApi.confirmBooking(booking._id, worker?._id, worker?.name);
      toast.success(`✅ Booking confirmed for ${booking.userId?.name || 'Customer'}!`, { duration: 4000 });
      load();

      // Auto-open map to customer's location
      setTimeout(() => {
        const bookedLat = booking.location?.lat || booking.userId?.location?.lat;
        if (bookedLat && onNavigateToMap) {
          toast('🗺️ Opening map to customer location...', { icon: '📍' });
          onNavigateToMap({ ...booking, status: 'accepted', workerId: worker || booking.workerId, _autoFocus: true });
        }
      }, 500);
    } catch {
      toast.error('Confirm failed');
      load();
    }
    setConfirming(null);
    setAssignModal(null);
  };

  const filtered = bookings.filter(b => {
    const custName = (b.userId?.name || b.userName || '').toLowerCase();
    const serviceName = (b.service || '').toLowerCase();
    const catName = (b.category || '').toLowerCase();
    const query = search.toLowerCase();
    const matchSearch = custName.includes(query) || serviceName.includes(query) || catName.includes(query);
    const matchFilter = filter === 'all' || b.status === filter;
    return matchSearch && matchFilter;
  });

  // Calculate Metrics
  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    active: bookings.filter(b => ['accepted', 'on_the_way', 'arrived', 'ongoing'].includes(b.status)).length,
    completed: bookings.filter(b => b.status === 'completed').length,
    revenue: bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.price || 0), 0)
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── Page Header ─────────────────────────── */}
      <div className="page-hero" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-hero-title">
            Advanced <span className="gradient-text">Booking Management</span>
          </h2>
          <div className="page-hero-sub">
            <span className="live-dot" /> Real-Time Engine Active • {stats.total} Total Bookings
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="btn-group" style={{ background: 'var(--card2)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
            <button 
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('table')}
              style={{ borderRadius: 8 }}
            >
              📋 Table View
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'board' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('board')}
              style={{ borderRadius: 8 }}
            >
              📊 Kanban Board
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={load}>🔄 Refresh Data</button>
        </div>
      </div>

      {/* ── Metric Cards Bar ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: 'var(--card)', padding: '14px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase' }}>Total Bookings</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{stats.total}</div>
        </div>
        <div style={{ background: stats.pending > 0 ? 'rgba(245,158,11,0.08)' : 'var(--card)', padding: '14px 18px', borderRadius: 16, border: stats.pending > 0 ? '1px solid #F59E0B' : '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            {stats.pending > 0 && <span className="live-dot" style={{ background: '#F59E0B' }} />} Action Required
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#F59E0B', marginTop: 4 }}>{stats.pending} Pending</div>
        </div>
        <div style={{ background: 'var(--card)', padding: '14px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600, textTransform: 'uppercase' }}>In Progress / Active</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#8B5CF6', marginTop: 4 }}>{stats.active}</div>
        </div>
        <div style={{ background: 'var(--card)', padding: '14px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, textTransform: 'uppercase' }}>Completed Jobs</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981', marginTop: 4 }}>{stats.completed}</div>
        </div>
        <div style={{ background: 'var(--card)', padding: '14px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981', marginTop: 4 }}>₹{stats.revenue.toLocaleString()}</div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'pending', 'accepted', 'on_the_way', 'arrived', 'ongoing', 'completed', 'cancelled'].map(s => {
            const count = s === 'all' ? bookings.length : bookings.filter(b => b.status === s).length;
            const cfg = STATUS_CONFIG[s] || { label: s, color: 'var(--text)' };
            const isActive = filter === s;
            return (
              <button 
                key={s} 
                onClick={() => setFilter(s)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  textTransform: 'capitalize', 
                  borderRadius: 12,
                  borderColor: isActive ? cfg.color : undefined,
                  background: isActive ? cfg.color : undefined
                }}
              >
                {s === 'all' ? `All (${count})` : `${cfg.label} (${count})`}
              </button>
            );
          })}
        </div>
        <div className="search-bar" style={{ width: 240, marginLeft: 'auto' }}>
          <span className="search-icon">🔍</span>
          <input className="input" placeholder="Search service, customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  VIEW MODE 1: TABLE VIEW                                     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'table' && (
        <div className="table-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <div className="table-header" style={{ padding: '16px 20px', background: 'var(--card)' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Live Booking Records ({filtered.length})</h3>
            <span className="badge badge-active"><span className="live-dot" style={{ marginRight: 6 }} />Synced</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer Details</th>
                <th>Service & Category</th>
                <th>Location</th>
                <th>Assigned Worker</th>
                <th>Scheduled Date</th>
                <th>Amount</th>
                <th>Workflow Status</th>
                <th style={{ textAlign: 'right' }}>Management Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 44 }} /></td></tr>
                ))
              ) : (
                filtered.map((b, i) => {
                  const cfg = STATUS_CONFIG[b.status] || { label: b.status, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', icon: '📌' };
                  return (
                    <tr key={b._id} className="fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-sub)', fontWeight: 600 }}>
                        #{String(b._id).slice(-6).toUpperCase()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="admin-avatar" style={{ width: 34, height: 34, fontSize: 14, fontWeight: 700 }}>
                            {(b.userId?.name || b.userName || 'C')[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{b.userId?.name || b.userName || 'Customer'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{b.userId?.phone || b.userPhone || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{b.service}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{b.category || 'General'}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {b.location?.address ? (
                          <div style={{ color: 'var(--text-sub)', fontSize: 11 }} title={b.location.address}>
                            📍 {b.location.address.slice(0, 24)}{b.location.address.length > 24 ? '…' : ''}
                          </div>
                        ) : <span style={{ color: 'var(--text-dim)' }}>Not provided</span>}
                      </td>
                      <td>
                        {b.workerId?.name || b.workerName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12 }}>👷</span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{b.workerId?.name || b.workerName}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                        {new Date(b.scheduledTime || b.createdAt || Date.now()).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 800, color: '#10B981', fontSize: 14 }}>₹{b.price || 0}</td>
                      <td>
                        <span 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            padding: '4px 10px', 
                            borderRadius: 20, 
                            fontSize: 11, 
                            fontWeight: 700, 
                            color: cfg.color, 
                            background: cfg.bg,
                            border: `1px solid ${cfg.border}`
                          }}
                        >
                          <span>{cfg.icon}</span> {cfg.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* View Detail Drawer */}
                          <button className="btn btn-xs btn-secondary" title="View Full Details" onClick={() => setSelected(b)}>
                            👁 View
                          </button>

                          {/* Invoice (Completed Only) */}
                          {b.status === 'completed' && (
                            <button 
                              className="btn btn-xs" 
                              style={{ background: '#10B981', color: 'white', fontWeight: 'bold' }} 
                              onClick={() => viewInvoice(b._id)}
                            >
                              🧾 Invoice
                            </button>
                          )}

                          {/* Confirm Button (Pending Only) */}
                          {b.status === 'pending' && (
                            <button
                              className="btn btn-xs btn-success"
                              style={{ background: 'linear-gradient(135deg,#10B981,#059669)', fontWeight: 700 }}
                              disabled={confirming === b._id}
                              onClick={() => { setAssignModal(b); setSelectedWorker(''); }}
                            >
                              {confirming === b._id ? '⏳' : '✅ Confirm'}
                            </button>
                          )}

                          {/* Assign / Swap Worker Button */}
                          {['pending', 'accepted'].includes(b.status) && (
                            <button className="btn btn-xs btn-secondary" title="Assign Worker" onClick={() => { setAssignModal(b); setSelectedWorker(b.workerId?._id || ''); }}>
                              👷 Worker
                            </button>
                          )}

                          {/* Live Map Link */}
                          {(b.location?.lat || b.userId?.location?.lat) && (
                            <button className="btn btn-xs btn-primary" title="Map Tracking" onClick={() => onNavigateToMap && onNavigateToMap(b)}>
                              🗺️ Map
                            </button>
                          )}

                          {/* Next Linear Workflow Actions */}
                          {b.status === 'accepted' && (
                            <button className="btn btn-xs" style={{ background: '#3B82F6', color: 'white', fontWeight: 700 }} onClick={() => updateStatus(b._id, 'on_the_way')}>
                              🏍️ On Way
                            </button>
                          )}
                          {b.status === 'on_the_way' && (
                            <button className="btn btn-xs" style={{ background: '#06B6D4', color: 'white', fontWeight: 700 }} onClick={() => updateStatus(b._id, 'arrived')}>
                              📍 Arrived
                            </button>
                          )}
                          {b.status === 'arrived' && (
                            <button className="btn btn-xs" style={{ background: '#EC4899', color: 'white', fontWeight: 700 }} onClick={() => updateStatus(b._id, 'ongoing')}>
                              🛠️ Start Job
                            </button>
                          )}
                          {['ongoing', 'in_progress', 'started'].includes(b.status) && (
                            <button className="btn btn-xs btn-success" style={{ fontWeight: 700 }} onClick={() => updateStatus(b._id, 'completed')}>
                              🎉 Complete
                            </button>
                          )}

                          {/* Cancel Option for non-finished bookings */}
                          {!['completed', 'cancelled'].includes(b.status) && (
                            <button className="btn btn-xs btn-danger" title="Cancel Booking" onClick={() => updateStatus(b._id, 'cancelled')}>
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 50, color: 'var(--text-sub)' }}>
                    No bookings found matching filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  VIEW MODE 2: KANBAN BOARD VIEW                                */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
          {[
            { id: 'pending', title: 'Pending Confirmation', icon: '⏳', color: '#F59E0B' },
            { id: 'accepted', title: 'Confirmed & Assigned', icon: '✅', color: '#8B5CF6' },
            { id: 'on_the_way', title: 'On Way / Arrived', icon: '🏍️', color: '#3B82F6' },
            { id: 'ongoing', title: 'In Progress', icon: '🛠️', color: '#EC4899' },
            { id: 'completed', title: 'Completed', icon: '🎉', color: '#10B981' },
          ].map(col => {
            const colBookings = filtered.filter(b => {
              if (col.id === 'on_the_way') return ['on_the_way', 'arrived'].includes(b.status);
              if (col.id === 'ongoing') return ['ongoing', 'in_progress', 'started'].includes(b.status);
              return b.status === col.id;
            });

            return (
              <div 
                key={col.id} 
                style={{ 
                  background: 'var(--card)', 
                  borderRadius: 16, 
                  padding: 14, 
                  border: '1px solid var(--border)',
                  minHeight: 400
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: col.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{col.icon}</span> {col.title}
                  </div>
                  <span style={{ background: 'var(--card2)', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    {colBookings.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {colBookings.map(b => (
                    <div 
                      key={b._id} 
                      style={{ 
                        background: 'var(--card2)', 
                        padding: 14, 
                        borderRadius: 14, 
                        border: '1px solid var(--border)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-sub)' }}>
                          #{String(b._id).slice(-5).toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 800, color: '#10B981', fontSize: 13 }}>₹{b.price || 0}</span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{b.service}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 8 }}>
                        👤 {b.userId?.name || b.userName || 'Customer'}
                      </div>

                      {b.location?.address && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>📍</span> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.location.address}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                          {b.workerId?.name ? `👷 ${b.workerId.name}` : '⚠️ No Worker'}
                        </span>
                        <button className="btn btn-xs btn-primary" onClick={() => setSelected(b)}>Details →</button>
                      </div>
                    </div>
                  ))}
                  {colBookings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 12 }}>
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  MODAL 1: ADVANCED BOOKING DETAIL & TIMELINE DRAWER           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, borderRadius: 20 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>📦 Booking Lifecycle #{String(selected._id).slice(-6).toUpperCase()}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{selected.service} • ₹{selected.price}</div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Stepper Timeline Tracker */}
            <div style={{ margin: '16px 0', padding: 16, background: 'var(--card2)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', marginBottom: 12 }}>
                Progression Workflow Timeline
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                {[
                  { key: 'pending', label: 'Placed' },
                  { key: 'accepted', label: 'Confirmed' },
                  { key: 'on_the_way', label: 'On Way' },
                  { key: 'arrived', label: 'Arrived' },
                  { key: 'ongoing', label: 'Started' },
                  { key: 'completed', label: 'Done' },
                ].map((step, idx, arr) => {
                  const ranks = { pending: 0, accepted: 1, on_the_way: 2, arrived: 3, ongoing: 4, completed: 5 };
                  const currentRank = ranks[selected.status] ?? 0;
                  const isDone = idx <= currentRank;
                  const isCurrent = idx === currentRank;

                  return (
                    <div key={step.key} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                      <div 
                        style={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: '50%', 
                          background: isDone ? '#10B981' : 'var(--card)',
                          border: `2px solid ${isDone ? '#10B981' : 'var(--border)'}`,
                          color: 'white',
                          margin: '0 auto 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 700
                        }}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: isCurrent ? 700 : 500, color: isDone ? 'var(--text)' : 'var(--text-dim)' }}>
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 600 }}>Customer Name</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.userId?.name || selected.userName || 'N/A'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>📞 {selected.userPhone || selected.userId?.phone || 'N/A'}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 600 }}>Assigned Worker</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.workerId?.name || selected.workerName || 'Not Assigned'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>Category: {selected.category || 'General'}</div>
              </div>
            </div>

            {/* Address */}
            {selected.location?.address && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 600 }}>Service Address</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>📍 {selected.location.address}</div>
              </div>
            )}

            {/* Service Photo Gallery (Problem, Before, After) */}
            {(selected.customerProblemPhoto || selected.problemPhoto || selected.workerBeforePhoto || selected.beforePhoto || selected.workerAfterPhoto || selected.afterPhoto) && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', marginBottom: 10 }}>
                  📷 Service Photo Proof Gallery
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {(selected.customerProblemPhoto || selected.problemPhoto) && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 4, fontWeight: 600 }}>Customer Problem</div>
                      <img 
                        src={selected.customerProblemPhoto || selected.problemPhoto} 
                        alt="Problem" 
                        onClick={() => setPreviewPhoto(selected.customerProblemPhoto || selected.problemPhoto)}
                        style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }} 
                      />
                    </div>
                  )}
                  {(selected.workerBeforePhoto || selected.beforePhoto) && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 4, fontWeight: 600 }}>Worker Before Work</div>
                      <img 
                        src={selected.workerBeforePhoto || selected.beforePhoto} 
                        alt="Before" 
                        onClick={() => setPreviewPhoto(selected.workerBeforePhoto || selected.beforePhoto)}
                        style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }} 
                      />
                    </div>
                  )}
                  {(selected.workerAfterPhoto || selected.afterPhoto) && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 4, fontWeight: 600 }}>Worker After Work</div>
                      <img 
                        src={selected.workerAfterPhoto || selected.afterPhoto} 
                        alt="After" 
                        onClick={() => setPreviewPhoto(selected.workerAfterPhoto || selected.afterPhoto)}
                        style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {(selected.location?.lat || selected.userId?.location?.lat) && (
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1 }} 
                  onClick={() => { setSelected(null); onNavigateToMap && onNavigateToMap(selected); }}
                >
                  🗺️ Track Live Map
                </button>
              )}
              {selected.status === 'completed' && (
                <button className="btn btn-success" style={{ flex: 1 }} onClick={() => viewInvoice(selected._id)}>
                  🧾 View Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  MODAL 2: ASSIGN WORKER & CONFIRM MODAL                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: 20 }}>
            <div className="modal-header">
              <h3>👷 Confirm & Assign Worker</h3>
              <button className="modal-close" onClick={() => setAssignModal(null)}>✕</button>
            </div>

            <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>Service Requested</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{assignModal.service}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 8 }}>
                Customer: <b>{assignModal.userId?.name || assignModal.userName || 'Customer'}</b> • ₹{assignModal.price}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Select Verified Worker</label>
              <select className="input select" value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)}>
                <option value="">Auto-assign later...</option>
                {workers.filter(w => w.active !== false).map(w => (
                  <option key={w._id} value={w._id}>
                    {w.name} — {w.category || (w.skills && w.skills[0]) || 'General'} ⭐{(w.rating || 4.2).toFixed(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAssignModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, background: 'linear-gradient(135deg,#10B981,#059669)' }}
                disabled={confirming === assignModal._id}
                onClick={() => confirmBooking(assignModal)}
              >
                {confirming === assignModal._id ? '⏳ Confirming...' : '✅ Confirm & Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  MODAL 3: INVOICE VIEWER                                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {invoiceModal && invoiceData && (
        <div className="modal-overlay" onClick={() => { setInvoiceModal(false); setInvoiceData(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>📄 TAX INVOICE</h3>
              <button className="modal-close" onClick={() => { setInvoiceModal(false); setInvoiceData(null); }}>✕</button>
            </div>
            <div style={{ background: '#fff', color: '#0f172a', padding: 20, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>{invoiceData.company.name}</h3>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{invoiceData.company.address}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Ph: {invoiceData.company.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800 }}>INVOICE</div>
                  <div>No: {invoiceData.invoiceNo}</div>
                  <div>Date: {invoiceData.date}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 15, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 10, color: '#64748b' }}>Customer Info</div>
                  <div style={{ fontWeight: 700 }}>{invoiceData.customer?.name || 'Customer'}</div>
                  <div>Phone: {invoiceData.customer?.phone || 'N/A'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 10, color: '#64748b' }}>Worker Assigned</div>
                  <div style={{ fontWeight: 700 }}>{invoiceData.worker?.name || 'N/A'}</div>
                </div>
              </div>

              <table style={{ width: '100%', marginTop: 15, borderCollapse: 'collapse', color: '#0f172a' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'left', padding: 5 }}>Description</th>
                    <th style={{ textAlign: 'right', padding: 5 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoiceData.items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 6 }}>{item.description || item.name}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>₹{item.amount}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #0f172a' }}>
                    <td style={{ padding: 6, textAlign: 'right', fontWeight: 800, fontSize: 14 }}>Grand Total</td>
                    <td style={{ padding: 6, textAlign: 'right', fontWeight: 800, fontSize: 14 }}>₹{invoiceData.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 15, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setInvoiceModal(false); setInvoiceData(null); }}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print Invoice</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  MODAL 4: PHOTO PREVIEW ZOOM MODAL                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {previewPhoto && (
        <div className="modal-overlay" onClick={() => setPreviewPhoto(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, padding: 12, textAlign: 'center', background: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setPreviewPhoto(null)}>✕</button>
            </div>
            <img src={previewPhoto} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
}
