import React, { useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { adminApi } from '../services/api';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CITY_COLORS = ['#7C3AED','#06B6D4','#10B981','#F59E0B','#EC4899','#EF4444','#8B5CF6'];
const SERVICE_COLORS = [
  'rgba(124,58,237,0.75)','rgba(6,182,212,0.75)','rgba(16,185,129,0.75)',
  'rgba(245,158,11,0.75)','rgba(236,72,153,0.75)','rgba(239,68,68,0.75)','rgba(139,92,246,0.75)'
];

const lineOpts = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { labels: { color: '#7880A8', font: { family: 'Outfit', size: 12 }, boxWidth: 12 } },
    tooltip: { backgroundColor: '#1a1d3a', titleColor: '#e2e8f0', bodyColor: '#a5b4fc', borderColor: '#2d3168', borderWidth: 1, cornerRadius: 10, padding: 12 }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#7880A8', font: { family: 'Inter', size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7880A8', font: { family: 'Inter', size: 11 } } }
  }
};

const barOpts = {
  ...lineOpts,
  plugins: { ...lineOpts.plugins, legend: { display: false } },
};

const donutOpts = {
  responsive: true, maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { position: 'right', labels: { color: '#a5b4fc', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 12 } },
    tooltip: { backgroundColor: '#1a1d3a', titleColor: '#e2e8f0', bodyColor: '#a5b4fc', borderColor: '#2d3168', borderWidth: 1 }
  }
};

// ── helpers ────────────────────────────────────────────────────
function buildRevenueTrend(bookings) {
  const now = new Date();
  const year = now.getFullYear();
  const monthly = Array(12).fill(0);
  bookings
    .filter(b => b.status === 'completed')
    .forEach(b => {
      const d = new Date(b.createdAt);
      if (d.getFullYear() === year) monthly[d.getMonth()] += (b.price || 0);
    });
  return monthly;
}

function buildCategoryBreakdown(bookings) {
  const map = {};
  bookings.forEach(b => {
    const cat = b.category || b.service || 'Other';
    map[cat] = (map[cat] || 0) + 1;
  });
  return map;
}

function buildCityDistribution(workers) {
  const map = {};
  workers.forEach(w => {
    const city = w.city || 'Hyderabad';
    map[city] = (map[city] || 0) + 1;
  });
  return map;
}

export default function AnalyticsPage() {
  const [bookings, setBookings] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('Monthly');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, wRes, sRes, pRes] = await Promise.all([
        adminApi.getBookings(),
        adminApi.getWorkers(),
        adminApi.getStats(),
        adminApi.getPayouts ? adminApi.getPayouts() : fetch('http://localhost:5000/api/admin/payouts').then(r => r.json()),
      ]);
      if (bRes?.bookings)  setBookings(bRes.bookings);
      if (wRes?.workers)   setWorkers(wRes.workers);
      if (sRes?.stats)     setStats(sRes.stats);
      if (pRes?.payouts)   setPayouts(pRes.payouts);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Analytics fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── derived data ───────────────────────────────────────────
  const revMonthly = buildRevenueTrend(bookings);
  const totalRevenue = revMonthly.reduce((a, b) => a + b, 0);
  const avgOrder = bookings.filter(b => b.status === 'completed').length
    ? Math.round(totalRevenue / bookings.filter(b => b.status === 'completed').length)
    : 0;
  const categoryMap = buildCategoryBreakdown(bookings);
  const cityMap = buildCityDistribution(workers);

  // Platform cut vs worker earnings from payouts
  const totalWorkerEarnings = payouts.reduce((s, p) => s + (p.totalEarnings || 0), 0);
  const platformCut = Math.round(totalRevenue * 0.3);

  const kpis = [
    { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: '💰', color: '#10B981', sub: `${bookings.filter(b => b.status === 'completed').length} completed jobs` },
    { label: 'Avg Order Value', value: `₹${avgOrder.toLocaleString('en-IN')}`, icon: '📊', color: '#7C3AED', sub: `${bookings.length} total bookings` },
    { label: 'Platform Cut (30%)', value: `₹${platformCut.toLocaleString('en-IN')}`, icon: '🏦', color: '#06B6D4', sub: `₹${totalWorkerEarnings.toLocaleString('en-IN')} to workers` },
    { label: 'Active Workers', value: workers.filter(w => w.active !== false).length, icon: '👷', color: '#F59E0B', sub: `${workers.length} total registered` },
  ];

  // Revenue line chart
  const revenueLineData = {
    labels: MONTHS,
    datasets: [{
      label: 'Revenue ₹',
      data: revMonthly,
      borderColor: '#7C3AED',
      backgroundColor: 'rgba(124,58,237,0.08)',
      fill: true, tension: 0.45, borderWidth: 2.5,
      pointBackgroundColor: '#9D5AF7', pointRadius: 4, pointHoverRadius: 7,
    }]
  };

  // Platform vs Worker bar chart
  const splitBarData = {
    labels: MONTHS,
    datasets: [
      {
        label: 'Worker Earnings (70%)',
        data: revMonthly.map(v => Math.round(v * 0.7)),
        backgroundColor: 'rgba(124,58,237,0.6)',
        borderRadius: 6, borderSkipped: false,
      },
      {
        label: 'Platform Cut (30%)',
        data: revMonthly.map(v => Math.round(v * 0.3)),
        backgroundColor: 'rgba(6,182,212,0.5)',
        borderRadius: 6, borderSkipped: false,
      }
    ]
  };
  const splitBarOpts = {
    ...lineOpts,
    scales: { ...lineOpts.scales, x: { ...lineOpts.scales.x, stacked: true }, y: { ...lineOpts.scales.y, stacked: true } }
  };

  // Category bar
  const catLabels = Object.keys(categoryMap);
  const catBarData = {
    labels: catLabels,
    datasets: [{
      label: 'Bookings',
      data: catLabels.map(k => categoryMap[k]),
      backgroundColor: SERVICE_COLORS.slice(0, catLabels.length),
      borderRadius: 8, borderSkipped: false,
    }]
  };

  // City doughnut
  const cityLabels = Object.keys(cityMap);
  const cityDonutData = {
    labels: cityLabels,
    datasets: [{
      data: cityLabels.map(k => cityMap[k]),
      backgroundColor: CITY_COLORS.slice(0, cityLabels.length),
      borderWidth: 0, hoverOffset: 8,
    }]
  };

  // Sorted payout leaderboard
  const sortedPayouts = [...payouts].sort((a, b) => b.totalEarnings - a.totalEarnings);

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Advanced <span className="gradient-text">Analytics</span></h2>
          <div className="page-hero-sub">
            <span className="live-dot" />
            Live Business Intelligence · Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['Daily', 'Weekly', 'Monthly'].map(p => (
            <button
              key={p}
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p)}
            >{p}</button>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={fetchAll} disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              const csv = ['Month,Revenue,Worker Earnings,Platform Cut', ...MONTHS.map((m, i) => `${m},${revMonthly[i]},${Math.round(revMonthly[i]*0.7)},${Math.round(revMonthly[i]*0.3)}`)].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fixon_revenue.csv'; a.click();
            }}
          >📥 Export CSV</button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-sub)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div>Loading live analytics data...</div>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Row 1: Revenue trend + Split bar ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="chart-card fade-in" style={{ animationDelay: '320ms' }}>
          <div className="chart-header">
            <h3>📈 Annual Revenue Trend</h3>
            <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>Live from bookings</span>
          </div>
          <div style={{ height: 240 }}>
            {bookings.length > 0
              ? <Line data={revenueLineData} options={lineOpts} />
              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}>No completed bookings yet</div>
            }
          </div>
        </div>

        <div className="chart-card fade-in" style={{ animationDelay: '400ms' }}>
          <div className="chart-header">
            <h3>🏦 Revenue Split (Worker vs Platform)</h3>
            <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>70/30 model</span>
          </div>
          <div style={{ height: 240 }}>
            {bookings.length > 0
              ? <Bar data={splitBarData} options={{ ...splitBarOpts, plugins: { ...lineOpts.plugins } }} />
              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}>No revenue data yet</div>
            }
          </div>
        </div>
      </div>

      {/* ── Row 2: Category bar + City doughnut ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="chart-card fade-in" style={{ animationDelay: '480ms' }}>
          <div className="chart-header">
            <h3>🛠️ Bookings by Service Category</h3>
          </div>
          <div style={{ height: 240 }}>
            {catLabels.length > 0
              ? <Bar data={catBarData} options={barOpts} />
              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}>No booking data yet</div>
            }
          </div>
        </div>

        <div className="chart-card fade-in" style={{ animationDelay: '540ms' }}>
          <div className="chart-header">
            <h3>🗺️ Worker City Distribution</h3>
          </div>
          <div style={{ height: 240 }}>
            {cityLabels.length > 0
              ? <Doughnut data={cityDonutData} options={donutOpts} />
              : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-sub)' }}>
                  <div style={{ fontSize: 32 }}>🗺️</div>
                  <div style={{ fontSize: 13 }}>All workers in Hyderabad</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Set city field per worker to see distribution</div>
                </div>
              )
            }
          </div>
        </div>
      </div>

      {/* ── Row 3: Payout Leaderboard ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card fade-in" style={{ animationDelay: '600ms' }}>
          <h3 style={{ marginBottom: 18, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🏆 Worker Payout Leaderboard
            <span style={{ fontSize: 11, color: 'var(--text-sub)', fontWeight: 400 }}>Live from completed jobs</span>
          </h3>
          {sortedPayouts.length === 0 ? (
            <div style={{ color: 'var(--text-sub)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
              No payouts yet — complete some bookings!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedPayouts.slice(0, 6).map((w, i) => {
                const maxEarning = sortedPayouts[0]?.totalEarnings || 1;
                const pct = Math.round((w.totalEarnings / maxEarning) * 100);
                const col = CITY_COLORS[i % CITY_COLORS.length];
                return (
                  <div key={w.workerId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${col}22`, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>{w.category} · {w.totalJobs} jobs · ⭐ {w.rating || 'N/A'}</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: col }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: col }}>₹{w.totalEarnings.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-sub)' }}>earnings</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Quick Stats table ────────────────────────────── */}
        <div className="card fade-in" style={{ animationDelay: '660ms' }}>
          <h3 style={{ marginBottom: 18, fontSize: 16 }}>📋 Platform Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Total Bookings', value: bookings.length, icon: '📦' },
              { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, icon: '✅' },
              { label: 'Pending', value: bookings.filter(b => b.status === 'pending').length, icon: '⏳' },
              { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length, icon: '❌' },
              { label: 'Total Workers', value: workers.length, icon: '👷' },
              { label: 'Active Workers', value: workers.filter(w => w.active !== false).length, icon: '🟢' },
              { label: 'Avg Worker Rating', value: workers.length ? (workers.reduce((s, w) => s + parseFloat(w.rating || 0), 0) / workers.length).toFixed(1) + ' ⭐' : 'N/A', icon: '⭐' },
              { label: 'Gross Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: '💰' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>{row.icon} {row.label}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
