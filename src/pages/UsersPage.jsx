import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

export default function UsersPage(props) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    load();
    if (props.socket) {
      props.socket.on('new_user', (newUser) => {
        setUsers(prev => {
          if (prev.find(u => u._id === newUser._id)) return prev;
          toast.success(`🆕 New customer registered: ${newUser.name || 'Anonymous'}`);
          return [newUser, ...prev];
        });
      });
      return () => props.socket.off('new_user');
    }
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
          { label: 'Active', value: users.filter(u => !u.isBlocked).length, icon: '✅', color: '#10B981' },
          { label: 'Blocked', value: users.filter(u => u.isBlocked).length, icon: '🚫', color: '#EF4444' },
          { label: 'New Today', value: users.filter(u => new Date(u.createdAt) > new Date(Date.now() - 86400000)).length, icon: '🆕', color: '#F59E0B' },
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
            <tr><th>#</th><th>Customer</th><th>Phone</th><th>Total Bookings</th><th>Location</th><th>Status</th><th>Actions</th></tr>
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
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name || 'N/A'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-sub)' }}>{u.phone || '—'}</td>
                <td><span style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{u.totalBookings || 0}</span></td>
                <td>
                  {u.location?.lat ? (
                    <span style={{ fontSize: 12, color: 'var(--secondary)' }}>📍 {u.location.lat.toFixed(3)}, {u.location.lng.toFixed(3)}</span>
                  ) : <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Not shared</span>}
                </td>
                <td><span className={`badge badge-${u.isBlocked ? 'inactive' : 'active'}`}>{u.isBlocked ? 'Blocked' : 'Active'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setSelected(u)}>👁 View</button>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👤 Customer Profile</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div className="admin-avatar" style={{ width: 60, height: 60, fontSize: 24 }}>{(selected.name || 'U')[0]}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{selected.name}</div>
                <div style={{ color: 'var(--text-sub)' }}>{selected.email}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['📞 Phone', selected.phone || 'N/A'],
                ['📅 Joined', new Date(selected.createdAt || Date.now()).toLocaleDateString()],
                ['📦 Bookings', selected.totalBookings || 0],
                ['📍 Location', selected.location?.lat ? `${selected.location.lat.toFixed(4)}, ${selected.location.lng.toFixed(4)}` : 'Not shared'],
                ['🔒 Status', selected.isBlocked ? 'Blocked' : 'Active'],
                ['💰 Spent', `₹${selected.totalSpent || 0}`],
              ].map(([label, val], i) => (
                <div key={i} style={{ padding: 14, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
