import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: 'admin@fixon.com', password: 'Admin@123' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back! 🎉');
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Background Orbs */}
      <div className="login-bg-orb" style={{ width: 600, height: 600, background: 'rgba(124,58,237,0.1)', top: -200, left: -200, animationDelay: '0s' }} />
      <div className="login-bg-orb" style={{ width: 400, height: 400, background: 'rgba(6,182,212,0.08)', bottom: -100, right: -100, animationDelay: '3s' }} />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="icon">🔧</div>
          <div>
            <div style={{ fontFamily: 'Outfit', fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>
              <span style={{ color: 'var(--primary)' }}>Fix</span>
              <span style={{ color: 'var(--secondary)' }}>oN</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)', letterSpacing: 2, fontWeight: 600 }}>ADMIN CONTROL PANEL</div>
          </div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Welcome back 👋</h2>
        <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 28 }}>Sign in to your admin account</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="admin@fixon.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: 44 }}
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-sub)' }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button id="login-btn" className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 4 }}>
            {loading ? <><span className="spin-anim" style={{ display: 'inline-block' }}>⏳</span> Signing in...</> : '🔐 Sign In to Admin Panel'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>DEFAULT CREDENTIALS</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>📧 admin@fixon.com / admin@servixo.com</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>🔑 Admin@123</div>
        </div>
      </div>
    </div>
  );
}
