import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import axios from 'axios';

const CLOUD = 'https://fixon-backend.onrender.com';

export default function UsersPage(props) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [bankLoading, setBankLoading] = useState(false);

  useEffect(() => {
    load();
    const poll = setInterval(load, 10000);
    if (props.socket) {
      const handleNewUser = () => {
        load();
        toast.success('🆕 New customer registered!');
      };
      const handleStatusUpdate = () => {
        load();
      };

      props.socket.on('new_user', handleNewUser);
      props.socket.on('user_join', handleStatusUpdate);
      props.socket.on('user_location', handleStatusUpdate);
      props.socket.on('user_offline', handleStatusUpdate);

      return () => { 
        clearInterval(poll); 
        props.socket.off('new_user', handleNewUser);
        props.socket.off('user_join', handleStatusUpdate);
        props.socket.off('user_location', handleStatusUpdate);
        props.socket.off('user_offline', handleStatusUpdate);
      };
    }
    return () => clearInterval(poll);
  }, [props.socket]);

  const load = async () => {
    try {
      const res = await adminApi.getUsers();
      setUsers(res.users || res || []);
    } catch { toast.error('Failed to load users'); }
    setLoading(false);
  };

  const handleBlock = async (id) => {
    try {
      await adminApi.blockUser(id);
      toast.success('User status updated');
      load();
    } catch { toast.error('Action failed'); }
  };

  const openUser = async (u) => {
    setSelected(u);
    setBankDetails(null);
    setBankLoading(true);
    // Try local then cloud
    try {
      let bd = null;
      try {
        const r = await axios.get(`http://localhost:3001/api/user/${u._id}/bank-details`, { timeout: 5000 });
        if (r.data?.success) bd = r.data.bankDetails;
      } catch {}
      if (!bd) {
        const r = await axios.get(`${CLOUD}/api/user/${u._id}/bank-details`, { timeout: 10000 });
        if (r.data?.success) bd = r.data.bankDetails;
      }
      setBankDetails(bd);
    } catch { setBankDetails(null); }
    setBankLoading(false);
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Customer <span className="gradient-text">Management</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />{users.length} registered customers</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: users.length, icon: '👥', color: '#7C3AED' },
          { label: 'Online Now', value: users.filter(u => u.isOnline).length, icon: '🟢', color: '#10B981' },
          { label: 'Blocked', value: users.filter(u => u.isBlocked).length, icon: '🚫', color: '#EF4444' },
          { label: 'Bank Details Saved', value: users.filter(u => u.bankDetails?.accountNumber || u.bankDetails?.upiId).length, icon: '🏦', color: '#F59E0B' },
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
          <h3>All Customers</h3>
          <div className="search-bar" style={{ width: 280 }}>
            <span className="search-icon">🔍</span>
            <input id="user-search" className="input" placeholder="Search name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Customer</th><th>Phone</th><th>Total Bookings</th><th>Bank Details</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 40 }} /></td></tr>
              ))
            ) : filtered.map((u, i) => (
              <tr key={u._id} className="fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <td style={{ color: 'var(--text-sub)', fontSize: 12 }}>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="admin-avatar" style={{ width: 38, height: 38, fontSize: 14 }}>{(u.name || 'U')[0]}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.name || 'N/A'}
                        {u.isOnline ? (
                          <span className="live-dot" style={{ width: 8, height: 8 }} title="Online Now" />
                        ) : (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6B7280', display: 'inline-block' }} title="Offline" />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-sub)' }}>{u.phone || '—'}</td>
                <td><span style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{u.totalBookings || 0}</span></td>
                <td>
                  {u.bankDetails?.upiId ? (
                    <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>🏦 Saved</span>
                  ) : u.bankDetails?.accountNumber ? (
                    <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>🏦 Saved</span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Not added</span>
                  )}
                </td>
                <td><span className={`badge badge-${u.isBlocked ? 'inactive' : 'active'}`}>{u.isBlocked ? 'Blocked' : 'Active'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openUser(u)}>👁 View</button>
                    <button className={`btn btn-sm ${u.isBlocked ? 'btn-success' : 'btn-danger'}`} onClick={() => handleBlock(u._id)}>
                      {u.isBlocked ? '✅ Unblock' : '🚫 Block'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>No customers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '95vw' }}>
            <div className="modal-header">
              <h3>👤 Customer Profile</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div className="admin-avatar" style={{ width: 60, height: 60, fontSize: 24 }}>{(selected.name || 'U')[0]}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{selected.name}</div>
                <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>{selected.email}</div>
                <div style={{ color: 'var(--text-sub)', fontSize: 12 }}>📞 {selected.phone || 'N/A'}</div>
              </div>
            </div>

            {/* Basic Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                ['📅 Joined', new Date(selected.createdAt || Date.now()).toLocaleDateString()],
                ['📦 Bookings', selected.totalBookings || 0],
                ['📍 Location', selected.location?.lat ? `${selected.location.lat.toFixed(4)}, ${selected.location.lng.toFixed(4)}` : 'Not shared'],
                ['🔒 Status', selected.isBlocked ? 'Blocked' : 'Active'],
              ].map(([label, val], i) => (
                <div key={i} style={{ padding: 14, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600 }}>{String(val)}</div>
                </div>
              ))}
            </div>

            {/* Bank Details Section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🏦</span>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Bank Details <span style={{ fontSize: 11, color: 'var(--text-sub)', fontWeight: 400 }}>(for refunds)</span></div>
                {bankLoading && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary)', borderTop: '2px solid transparent', animation: 'spin 0.8s linear infinite' }} />}
              </div>

              {bankLoading ? (
                <div style={{ color: 'var(--text-sub)', fontSize: 13, padding: '10px 0' }}>Loading bank details…</div>
              ) : bankDetails && (bankDetails.accountNumber || bankDetails.upiId) ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Account Name', bankDetails.accountName],
                    ['Account Number', bankDetails.accountNumber ? '•••• ' + bankDetails.accountNumber.slice(-4) : '—'],
                    ['IFSC Code', bankDetails.ifscCode],
                    ['Bank Name', bankDetails.bankName],
                    ['UPI ID', bankDetails.upiId],
                    ['Last Updated', bankDetails.updatedAt ? new Date(bankDetails.updatedAt).toLocaleDateString() : '—'],
                  ].map(([label, val], i) => (
                    <div key={i} style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: val && val !== '—' ? 'var(--text)' : 'var(--text-dim)' }}>{val || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '18px 16px',
                  borderRadius: 12,
                  background: 'rgba(245,158,11,0.06)',
                  border: '1px dashed rgba(245,158,11,0.3)',
                  textAlign: 'center',
                  color: 'var(--text-sub)',
                  fontSize: 13
                }}>
                  ⚠️ Customer has not added bank details yet.<br />
                  <span style={{ fontSize: 11, opacity: 0.7 }}>Ask customer to add bank details in the app for refunds.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
