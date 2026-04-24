import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { connectSocket, disconnectSocket } from './services/socket';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BookingsPage from './pages/BookingsPage';
import UsersPage from './pages/UsersPage';
import WorkersPage from './pages/WorkersPage';
import PaymentsPage from './pages/PaymentsPage';
import LiveMapPage from './pages/LiveMapPage';
import ChatPage from './pages/ChatPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ServicesPage from './pages/ServicesPage';
import CouponsPage from './pages/CouponsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import './index.css';

const PAGE_TITLES = {
  dashboard:     '📊 Dashboard',
  analytics:     '📈 Analytics',
  bookings:      '📦 Bookings',
  users:         '👥 Customers',
  workers:       '👷 Workers',
  payments:      '💳 Payments',
  services:      '🛠️ Services',
  coupons:       '🎟️ Coupons',
  livemap:       '🗺️ Live Map',
  chat:          '💬 Support Chat',
  notifications: '🔔 Notifications',
  settings:      '⚙️ Settings',
};

function AppInner() {
  const { admin, logout, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [socket, setSocket] = useState(null);
  const [focusedBooking, setFocusedBooking] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState([]);

  useEffect(() => {
    if (admin) {
      const s = connectSocket();
      setSocket(s);
      s.emit('admin_join');

      s.on('new_booking', (data) => {
        const toast = require('react-hot-toast').default;
        setNotifCount(n => n + 1);
        const notif = { icon: '📦', msg: `New Booking: ${data?.service || 'Service'} by ${data?.name || 'Customer'}`, time: new Date(), color: '#7C3AED' };
        setRecentNotifs(p => [notif, ...p.slice(0, 9)]);

        toast.custom((t) => (
          <div
            onClick={() => { toast.dismiss(t.id); handleNavigateToMap(data); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'var(--card)', padding: '14px 20px', borderRadius: 16,
              border: '1px solid rgba(124,58,237,0.4)', cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(124,58,237,0.25)',
              animation: 'slideUp 0.3s ease',
            }}>
            <div style={{ fontSize: 30, animation: 'pulse 1.5s infinite' }}>🚨</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#9D5AF7' }}>New Booking Alert!</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{data?.name || 'Customer'} → {data?.service || 'Service'}</div>
              <div style={{ fontSize: 11, color: 'var(--primary-light)', marginTop: 4 }}>Tap to view on Live Map 🗺️</div>
            </div>
          </div>
        ), { duration: 8000 });
      });

      s.on('payment_success', (data) => {
        setNotifCount(n => n + 1);
        setRecentNotifs(p => [{ icon: '💰', msg: `Payment ₹${data?.amount || ''} received`, time: new Date(), color: '#10B981' }, ...p.slice(0, 9)]);
      });

      s.on('booking_update', (data) => {
        setRecentNotifs(p => [{ icon: '🔄', msg: `Booking #${String(data?.bookingId || '').slice(-5)} → ${data?.status}`, time: new Date(), color: '#F59E0B' }, ...p.slice(0, 9)]);
      });

    } else {
      disconnectSocket();
      setSocket(null);
    }
    return () => {
      if (!admin) disconnectSocket();
    };
  }, [admin]);

  const handleNavigateToMap = (booking) => {
    setFocusedBooking(booking);
    setActivePage('livemap');
  };

  const handleNavClick = (page) => {
    setActivePage(page);
    if (page === 'notifications') setNotifCount(0);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 60, animation: 'float 2s ease-in-out infinite' }}>🔧</div>
        <div style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800 }}>
          <span style={{ color: 'var(--primary)' }}>Fix</span><span style={{ color: 'var(--secondary)' }}>oN</span>
          <span style={{ color: 'var(--text-sub)', fontSize: 14, fontWeight: 400, marginLeft: 10 }}>Loading admin panel...</span>
        </div>
        <div style={{ width: 200, height: 3, borderRadius: 2, background: 'var(--card2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 2, animation: 'shimmer 1.2s infinite', backgroundSize: '400% 100%' }} />
        </div>
      </div>
    );
  }

  if (!admin) return <LoginPage />;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':     return <Dashboard socket={socket} />;
      case 'analytics':     return <AnalyticsPage />;
      case 'bookings':      return <BookingsPage socket={socket} onNavigateToMap={handleNavigateToMap} />;
      case 'users':         return <UsersPage socket={socket} />;
      case 'workers':       return <WorkersPage />;
      case 'payments':      return <PaymentsPage />;
      case 'services':      return <ServicesPage />;
      case 'coupons':       return <CouponsPage />;
      case 'livemap':       return <LiveMapPage socket={socket} focusedBooking={focusedBooking} onClearFocus={() => setFocusedBooking(null)} />;
      case 'chat':          return <ChatPage socket={socket} />;
      case 'notifications': return <NotificationsPage />;
      case 'settings':      return <SettingsPage />;
      default:              return <Dashboard socket={socket} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={handleNavClick} onLogout={logout} admin={admin} />

      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">{PAGE_TITLES[activePage] || 'Dashboard'}</div>

          <div className="topbar-right">
            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="live-dot" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', letterSpacing: 0.5 }}>LIVE</span>
            </div>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <div className="topbar-action-btn" onClick={() => { setShowNotifPanel(!showNotifPanel); setNotifCount(0); }}>
                🔔
                {notifCount > 0 && (
                  <div className="badge-dot" style={{ width: 16, height: 16, fontSize: 9, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', top: -4, right: -4 }}>
                    {notifCount}
                  </div>
                )}
              </div>

              {/* Notif Dropdown */}
              {showNotifPanel && (
                <div style={{ position: 'absolute', top: 50, right: 0, width: 320, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 200, animation: 'slideUp 0.2s ease', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Live Notifications</span>
                    <span className="badge badge-active" style={{ fontSize: 9 }}>REAL-TIME</span>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {recentNotifs.length === 0 ? (
                      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-sub)' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                        <div style={{ fontSize: 13 }}>No notifications yet</div>
                      </div>
                    ) : recentNotifs.map((n, i) => (
                      <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'background 0.2s', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${n.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{n.icon}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{n.msg}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{new Date(n.time).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button className="btn btn-sm btn-secondary" style={{ width: '100%' }} onClick={() => { setShowNotifPanel(false); setActivePage('notifications'); }}>
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Profile */}
            <div className="topbar-profile">
              <div className="admin-avatar" style={{ width: 34, height: 34, fontSize: 14 }}>{(admin?.name || 'A')[0]}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{admin?.name || 'Admin'}</div>
                <div style={{ fontSize: 10, color: 'var(--text-sub)' }}>Super Admin</div>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="page-content" onClick={() => showNotifPanel && setShowNotifPanel(false)}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'Inter', fontSize: 13, borderRadius: 14 },
          success: { iconTheme: { primary: '#10B981', secondary: 'white' } },
          error: { iconTheme: { primary: '#EF4444', secondary: 'white' } },
        }}
      />
    </AuthProvider>
  );
}
