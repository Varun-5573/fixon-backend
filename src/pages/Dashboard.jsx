import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { adminApi } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#7880A8', font: { family: 'Outfit', size: 12 } } } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#7880A8', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7880A8', font: { size: 11 } } },
  },
};

function CountUp({ end, prefix = '', suffix = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!end || isNaN(end)) return;
    let cur = 0;
    const step = end / 60;
    const t = setInterval(() => {
      cur += step;
      if (cur >= end) { setVal(end); clearInterval(t); }
      else setVal(Math.floor(cur));
    }, 16);
    return () => clearInterval(t);
  }, [end]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

export default function Dashboard({ socket }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveCustomers, setLiveCustomers] = useState({ total: 0, active: 0 });

  useEffect(() => {
    load();
    loadLiveCustomers();
    const poll = setInterval(load, 20000);
    const custPoll = setInterval(loadLiveCustomers, 10000);

    if (socket) {
      const addEvent = (type, msg, icon, color) =>
        setLiveEvents(p => [{ type, msg, icon, color, time: new Date() }, ...p.slice(0, 9)]);

      socket.on('new_booking', b => { addEvent('booking', `New Booking: ${b.service || 'Service'}`, '📦', '#7C3AED'); load(); });
      socket.on('booking_update', d => { addEvent('update', `Booking #${String(d.bookingId||'').slice(-5)} → ${d.status}`, '🔄', '#F59E0B'); load(); });
      socket.on('payment_success', d => { addEvent('payment', `Payment ₹${d.amount||''}`, '💰', '#10B981'); load(); });
      socket.on('user_join', u => { addEvent('user', `Customer Online: ${u.name||'User'}`, '👤', '#06B6D4'); loadLiveCustomers(); });
      socket.on('new_user', u => {
        addEvent('user', `New Customer: ${u.name||'User'}`, '🆕', '#7C3AED');
        load();
        loadLiveCustomers();
      });
      socket.on('user_location', () => loadLiveCustomers());
    }
    return () => {
      clearInterval(poll); clearInterval(custPoll);
      socket?.off('new_booking'); socket?.off('booking_update');
      socket?.off('payment_success'); socket?.off('user_join');
      socket?.off('new_user'); socket?.off('user_location');
    };
  }, [socket]);

  const loadLiveCustomers = async () => {
    try {
      const r = await adminApi.getCustomerStats();
      if (r.success) {
        setLiveCustomers({ 
          total: r.totalUsers || 0, 
          active: r.activeUsers || 0,
          newToday: r.newUsersToday || 0 
        });
      }
    } catch {}
  };

  const load = async () => {
    try {
      const [s, b] = await Promise.all([adminApi.getStats(), adminApi.getBookings()]);
      if (s.success) setStats(s);
      if (b.success) setActivity(b.bookings || []);
    } catch {}
    setLoading(false);
  };

  const statCards = [
    { label: 'Total Customers', value: liveCustomers.total, icon: '👥', color: '#7C3AED', change: `+${liveCustomers.newToday} today`, up: true },
    { label: 'Live Customers', value: liveCustomers.active, icon: '📍', color: '#06B6D4', change: 'GPS active', up: true },
    { label: 'Active Workers', value: stats?.stats?.totalWorkers ?? 0, icon: '👷', color: '#10B981', change: 'Online', up: true },
    { label: 'Total Bookings', value: activity.length, icon: '📦', color: '#F59E0B', change: 'Live orders', up: true },
    { label: 'Completed', value: stats?.stats?.completedBookings ?? 0, icon: '✅', color: '#10B981', change: '+15%', up: true },
    { label: 'Total Revenue', value: stats?.stats?.totalRevenue ?? 0, icon: '💰', color: '#EC4899', prefix: '₹', change: '+31%', up: true },
  ];

  const lineData = {
    labels: (stats?.monthlyBookings || []).map(m => MONTHS[(m._id?.month || 1) - 1]),
    datasets: [{
      label: 'Bookings', data: (stats?.monthlyBookings || []).map(m => m.count),
      borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.08)',
      tension: 0.45, fill: true, pointBackgroundColor: '#9D5AF7', pointRadius: 5, pointHoverRadius: 7, borderWidth: 2.5
    }]
  };

  const barData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Revenue ₹', data: [4200, 6800, 5300, 7800, 5600, 9200, 8100],
      backgroundColor: ['rgba(124,58,237,0.7)', 'rgba(6,182,212,0.7)', 'rgba(124,58,237,0.7)', 'rgba(6,182,212,0.7)', 'rgba(124,58,237,0.7)', 'rgba(245,158,11,0.7)', 'rgba(16,185,129,0.7)'],
      borderRadius: 8, borderSkipped: false
    }]
  };

  const donutData = {
    labels: ['Completed', 'Pending', 'Ongoing', 'Cancelled'],
    datasets: [{ data: [stats?.stats?.completedBookings || 12, stats?.stats?.pendingBookings || 3, 2, 1], backgroundColor: ['#10B981', '#F59E0B', '#7C3AED', '#EF4444'], hoverOffset: 8, borderWidth: 0, borderRadius: 5 }]
  };

  return (
    <div>
      {/* Page Hero */}
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">System <span className="gradient-text">Pulse</span></h2>
          <div className="page-hero-sub">
            <span className="live-dot" />
            Real-time monitoring active • {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>🔄 Refresh</button>
          <button className="btn btn-primary btn-sm">📥 Export Report</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
        {statCards.map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)`, '--glow-bg': `${s.color}10` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>
              {loading ? <div className="skeleton" style={{ height: 30, width: 80 }} /> : <>{s.prefix}<CountUp end={s.value} /></>}
            </div>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-change ${s.up ? 'up' : 'down'}`}>
              {s.up ? '↑' : '↓'} {s.change} this week
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 22 }}>
        <div className="chart-card fade-in" style={{ animationDelay: '500ms' }}>
          <div className="chart-header">
            <div>
              <h3>Monthly Bookings</h3>
              <p style={{ color: 'var(--text-sub)', fontSize: 12, marginTop: 2 }}>Service request volume trend</p>
            </div>
            <select className="input select" style={{ width: 130, fontSize: 12 }}>
              <option>Last 6 Months</option><option>This Year</option>
            </select>
          </div>
          <div style={{ height: 260 }}><Line data={lineData} options={chartOpts} /></div>
        </div>

        <div className="chart-card fade-in" style={{ animationDelay: '600ms' }}>
          <div className="chart-header">
            <h3>Weekly Revenue</h3>
          </div>
          <div style={{ height: 260 }}><Bar data={barData} options={chartOpts} /></div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Recent Bookings */}
        <div className="table-card fade-in" style={{ animationDelay: '650ms', gridColumn: 'span 2' }}>
          <div className="table-header">
            <h3>Recent Bookings</h3>
            <span className="badge badge-active"><span className="live-dot" style={{ marginRight: 4 }} />Live</span>
          </div>
          <table>
            <thead><tr><th>Customer</th><th>Service</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              {activity.slice(0, 6).map((b, i) => (
                <tr key={i} className="fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{(b.userId?.name || 'U')[0]}</div>
                      <span style={{ fontWeight: 500 }}>{b.userId?.name || 'Customer'}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-sub)' }}>{b.service}</td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td style={{ color: 'var(--text-sub)', fontSize: 12 }}>{new Date(b.createdAt || Date.now()).toLocaleTimeString()}</td>
                </tr>
              ))}
              {activity.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: 'var(--text-sub)' }}>No recent bookings</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Status Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="chart-card fade-in" style={{ animationDelay: '700ms' }}>
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Booking Distribution</h3>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                <Doughnut data={donutData} options={{ maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }} />
              </div>
              <div style={{ flex: 1 }}>
                {['Completed', 'Pending', 'Ongoing', 'Cancelled'].map((lbl, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: donutData.datasets[0].backgroundColor[i], display: 'inline-block' }} />
                      {lbl}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{donutData.datasets[0].data[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Feed */}
          <div className="card fade-in" style={{ animationDelay: '750ms', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15 }}>⚡ Live Feed</h3>
              <span className="badge badge-active" style={{ fontSize: 9 }}>REAL-TIME</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {liveEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-sub)', fontSize: 12 }}>
                  🛰️ Listening for events...
                </div>
              ) : liveEvents.map((e, i) => (
                <div key={i} className="fade-in" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${e.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{e.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>{e.msg}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-sub)' }}>{new Date(e.time).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
