import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#7880A8', font: { family: 'Outfit', size: 12 } } } },
  scales: { x: { grid: { display: false }, ticks: { color: '#7880A8' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7880A8' } } }
};

export default function AnalyticsPage() {

  const revenueData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [{
      label: 'Revenue ₹', data: [12000, 19000, 14000, 28000, 22000, 35000, 29000, 41000, 38000, 45000, 52000, 48000],
      borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.08)',
      fill: true, tension: 0.45, borderWidth: 2.5, pointBackgroundColor: '#9D5AF7', pointRadius: 4
    }]
  };

  const bookingBar = {
    labels: ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'AC Repair', 'Painting'],
    datasets: [{
      label: 'Bookings', data: [42, 38, 55, 28, 61, 23],
      backgroundColor: ['rgba(124,58,237,0.7)', 'rgba(6,182,212,0.7)', 'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(236,72,153,0.7)', 'rgba(239,68,68,0.7)'],
      borderRadius: 8, borderSkipped: false
    }]
  };

  const userGrowth = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      { label: 'New Users', data: [12, 28, 19, 35], borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.1)', fill: true, tension: 0.4, borderWidth: 2 },
      { label: 'Active Users', data: [8, 22, 15, 29], borderColor: '#06B6D4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4, borderWidth: 2 },
    ]
  };

  const topWorkers = [
    { name: 'Varun (Plumber)', jobs: 47, rating: 4.9, revenue: 23500, color: '#7C3AED' },
    { name: 'Siri (Electrician)', jobs: 39, rating: 4.8, revenue: 19800, color: '#06B6D4' },
    { name: 'Bunny (Cleaning)', jobs: 55, rating: 4.7, revenue: 16500, color: '#10B981' },
    { name: 'Ravi (Carpentry)', jobs: 31, rating: 4.6, revenue: 21000, color: '#F59E0B' },
    { name: 'Meera (Painting)', jobs: 23, rating: 4.5, revenue: 18200, color: '#EC4899' },
  ];

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Advanced <span className="gradient-text">Analytics</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />Business Intelligence Dashboard</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Daily', 'Weekly', 'Monthly'].map(p => <button key={p} className="btn btn-sm btn-secondary">{p}</button>)}
          <button className="btn btn-sm btn-primary">📥 Download Report</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Revenue', value: '₹2,47,800', change: '+31%', icon: '💰', color: '#10B981' },
          { label: 'Avg Order Value', value: '₹842', change: '+12%', icon: '📊', color: '#7C3AED' },
          { label: 'Customer Retention', value: '78%', change: '+5%', icon: '🔁', color: '#06B6D4' },
          { label: 'Worker Efficiency', value: '91%', change: '+8%', icon: '⚡', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-change up">↑ {s.change} this month</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="chart-card fade-in" style={{ animationDelay: '400ms' }}>
          <div className="chart-header"><h3>Annual Revenue Trend</h3></div>
          <div style={{ height: 260 }}><Line data={revenueData} options={chartOpts} /></div>
        </div>
        <div className="chart-card fade-in" style={{ animationDelay: '500ms' }}>
          <div className="chart-header"><h3>User Growth</h3></div>
          <div style={{ height: 260 }}><Line data={userGrowth} options={chartOpts} /></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="chart-card fade-in" style={{ animationDelay: '550ms' }}>
          <div className="chart-header"><h3>Most Booked Services</h3></div>
          <div style={{ height: 240 }}><Bar data={bookingBar} options={chartOpts} /></div>
        </div>

        {/* Top Workers */}
        <div className="card fade-in" style={{ animationDelay: '600ms' }}>
          <h3 style={{ marginBottom: 18, fontSize: 16 }}>🏆 Top Workers This Month</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topWorkers.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${w.color}20`, color: w.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</div>
                  <div className="progress-bar" style={{ marginTop: 4 }}>
                    <div className="progress-fill" style={{ width: `${(w.jobs / 60) * 100}%`, background: w.color }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: w.color }}>{w.jobs} jobs</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>⭐ {w.rating} • ₹{w.revenue.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
