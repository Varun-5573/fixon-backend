import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

const DEMO_ADMIN = { name: 'Admin', email: 'admin@fixon.com', role: 'super_admin' };
const VALID_EMAILS = ['admin@fixon.com', 'admin@servixo.com'];

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('fixon_admin');
    const token = localStorage.getItem('fixon_token');
    if (stored && token) setAdmin(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Try real backend first
    try {
      const res = await authApi.login({ email, password });
      if (res.success) {
        localStorage.setItem('fixon_token', res.token);
        localStorage.setItem('fixon_admin', JSON.stringify(res.admin));
        setAdmin(res.admin);
        return true;
      }
    } catch (err) {
      // Backend offline — use demo mode
      console.warn('Backend offline, using Demo Mode');
    }

    // Demo Mode: accept known credentials
    if (VALID_EMAILS.includes(email) && password === 'Admin@123') {
      const mockAdmin = { ...DEMO_ADMIN, email };
      localStorage.setItem('fixon_token', 'demo_token_fixon');
      localStorage.setItem('fixon_admin', JSON.stringify(mockAdmin));
      setAdmin(mockAdmin);
      return true;
    }
    throw new Error('Invalid credentials. Use admin@fixon.com / Admin@123');
  };

  const logout = () => {
    localStorage.removeItem('fixon_token');
    localStorage.removeItem('fixon_admin');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
