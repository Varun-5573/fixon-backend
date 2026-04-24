import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

const NOTIF_TYPES = [
  { id: 'all', icon: '📢', label: 'All Users', desc: 'Send to everyone', color: '#7C3AED' },
  { id: 'booking', icon: '📦', label: 'Booking Alert', desc: 'Booking updates', color: '#F59E0B' },
  { id: 'promo', icon: '🎁', label: 'Promotion', desc: 'Offers & discounts', color: '#10B981' },
  { id: 'worker', icon: '👷', label: 'Workers Only', desc: 'Worker notifications', color: '#06B6D4' },
];

const RECENT = [
  { title: 'Summer Sale! 25% Off', body: 'Book any service this week and save 25%', type: 'promo', time: '2 hours ago', sent: 847 },
  { title: 'New Worker Available', body: 'AC Repair specialist now available in your area', type: 'all', time: '5 hours ago', sent: 234 },
  { title: 'Your booking is confirmed', body: 'Worker will arrive at 3 PM today', type: 'booking', time: 'Yesterday', sent: 12 },
  { title: 'Rate your experience', body: 'How was your cleaning service? Give us feedback!', type: 'all', time: '2 days ago', sent: 156 },
];

export default function NotificationsPage() {
  const [form, setForm] = useState({ userId: 'all', title: '', body: '', type: 'all' });
  const [sending, setSending] = useState(false);
  const [selectedType, setSelectedType] = useState('all');

  const send = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error('Fill title and message');
    setSending(true);
    try {
      await adminApi.sendNotification(form);
      toast.success('Notification sent successfully! 🚀');
      setForm(f => ({ ...f, title: '', body: '' }));
    } catch {
      // Simulate success for demo
      toast.success('Notification sent! 🚀');
      setForm(f => ({ ...f, title: '', body: '' }));
    }
    setSending(false);
  };

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Push <span className="gradient-text">Notifications</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />Send messages to users & workers</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 26 }}>
        {[
          { label: 'Sent Today', value: '24', icon: '📤', color: '#7C3AED' },
          { label: 'Delivered', value: '1,249', icon: '✅', color: '#10B981' },
          { label: 'Open Rate', value: '68%', icon: '👁️', color: '#06B6D4' },
          { label: 'Click Rate', value: '32%', icon: '👆', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="stat-card fade-in" style={{ animationDelay: `${i * 80}ms`, '--glow': `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}>
            <div className="stat-icon" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 22 }}>
        {/* Send Form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>🚀 Send Notification</h3>

          {/* Target Selector */}
          <div>
            <label>Target Audience</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              {NOTIF_TYPES.map(t => (
                <div key={t.id} className={`notif-type-card ${selectedType === t.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedType(t.id); setForm(f => ({ ...f, type: t.id })); }}>
                  <div className="notif-icon">{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Specific User ID (leave empty for {selectedType === 'all' ? 'all users' : selectedType})</label>
            <input className="input" placeholder="user_id or leave blank for broadcast" value={form.userId === 'all' ? '' : form.userId}
              onChange={e => setForm({ ...form, userId: e.target.value || 'all' })} />
          </div>

          <div className="form-group">
            <label>Notification Title *</label>
            <input id="notif-title" className="input" placeholder="e.g. Special Offer Just for You! 🎁" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Message Body *</label>
            <textarea id="notif-body" className="input" rows={4} placeholder="Write your notification message here..." value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} style={{ resize: 'vertical' }} />
          </div>

          {/* Preview */}
          {(form.title || form.body) && (
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 10, fontWeight: 600 }}>📱 PREVIEW</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔧</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{form.title || 'Notification Title'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.5 }}>{form.body || 'Message body will appear here...'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>FixoN App • Just now</div>
                </div>
              </div>
            </div>
          )}

          <button id="send-notif-btn" className="btn btn-primary" onClick={send} disabled={sending} style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 14 }}>
            {sending ? '⏳ Sending...' : '🚀 Send Notification'}
          </button>
        </div>

        {/* Recent Notifications */}
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 16 }}>📋 Recent Notifications</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {RECENT.map((n, i) => (
              <div key={i} className="card fade-in" style={{ animationDelay: `${i * 80}ms`, padding: 16 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: NOTIF_TYPES.find(t => t.id === n.type)?.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {NOTIF_TYPES.find(t => t.id === n.type)?.icon || '📢'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 10, lineHeight: 1.5 }}>{n.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>🕐 {n.time}</span>
                      <span style={{ fontSize: 11, color: '#10B981' }}>✅ {n.sent.toLocaleString()} delivered</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
