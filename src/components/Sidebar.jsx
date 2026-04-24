import React from 'react';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard',      icon: '📊', label: 'Dashboard' },
      { id: 'analytics',      icon: '📈', label: 'Analytics' },
    ]
  },
  {
    label: 'Management',
    items: [
      { id: 'bookings',   icon: '📦', label: 'Bookings',   badge: 'LIVE', badgeStyle: 'live' },
      { id: 'users',      icon: '👥', label: 'Customers' },
      { id: 'workers',    icon: '👷', label: 'Workers' },
      { id: 'payments',   icon: '💳', label: 'Payments' },
    ]
  },
  {
    label: 'Services',
    items: [
      { id: 'services',   icon: '🛠️', label: 'Services' },
      { id: 'coupons',    icon: '🎟️', label: 'Coupons' },
    ]
  },
  {
    label: 'Tools',
    items: [
      { id: 'livemap',       icon: '🗺️', label: 'Live Map',   badge: '●', badgeStyle: 'live' },
      { id: 'chat',          icon: '💬', label: 'Support Chat' },
      { id: 'notifications', icon: '🔔', label: 'Notifications' },
      { id: 'settings',      icon: '⚙️', label: 'Settings' },
    ]
  }
];

export default function Sidebar({ activePage, onNavigate, onLogout, admin }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">🔧</div>
        <div>
          <div className="logo-text"><span className="fix">Fix</span><span className="on">oN</span></div>
          <span className="logo-badge">ADMIN PANEL</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navGroups.map(group => (
          <div key={group.label}>
            <div className="nav-section-label">{group.label}</div>
            {group.items.map((item, idx) => (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`nav-badge ${item.badgeStyle}`}>{item.badge}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="admin-info">
          <div className="admin-avatar">{(admin?.name || 'A')[0].toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.name || 'Admin'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>Super Admin</div>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">🚪</button>
        </div>
      </div>
    </aside>
  );
}
