import axios from 'axios';

const isDev = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:' ||
  (navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron'))
);
const BASE   = isDev ? 'http://localhost:5000' : 'https://fixon-backend.onrender.com';
const CLOUD  = 'https://fixon-backend.onrender.com'; // always Render, for dual-write

const api = axios.create({ baseURL: BASE, timeout: 45000 });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('fixon_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r.data,
  e => Promise.reject(e.response?.data || { message: 'Network error' })
);

// ─── Demo Data ────────────────────────────────────────────
const DEMO_USERS = [
  { _id: 'u1', name: 'Adithya Varun', email: 'pittala@gmail.com', phone: '9876543210', isBlocked: false, totalBookings: 5, createdAt: new Date().toISOString(), location: { lat: 17.412, lng: 78.455 } },
  { _id: 'u2', name: 'Bonda Kumar', email: 'bonda@gmail.com', phone: '9123456789', isBlocked: false, totalBookings: 3, createdAt: new Date().toISOString(), location: { lat: 17.395, lng: 78.500 } },
  { _id: 'u3', name: 'Rahul Sharma', email: 'rahul@gmail.com', phone: '8888888888', isBlocked: false, totalBookings: 8, createdAt: new Date().toISOString(), location: {} },
  { _id: 'u4', name: 'Priya Reddy', email: 'priya@gmail.com', phone: '7777777777', isBlocked: true, totalBookings: 1, createdAt: new Date().toISOString(), location: {} },
];
const DEMO_WORKERS = [
  { _id: 'w1', name: 'Varun (Plumber)', email: 'varun@fixon.com', phone: '9999999999', category: 'Maintenance', skills: ['Plumbing'], isAvailable: true, isActive: true, rating: 4.9, currentLocation: { lat: 17.385, lng: 78.487 } },
  { _id: 'w2', name: 'Siri (Electrician)', email: 'siri@fixon.com', phone: '8888888888', category: 'Maintenance', skills: ['Electrical'], isAvailable: false, isActive: true, rating: 4.8, currentLocation: { lat: 17.405, lng: 78.497 } },
  { _id: 'w3', name: 'Bunny (Cleaning)', email: 'bunny@fixon.com', phone: '7777777777', category: 'Home Services', skills: ['Cleaning'], isAvailable: true, isActive: true, rating: 4.7, currentLocation: { lat: 17.375, lng: 78.477 } },
  { _id: 'w4', name: 'Ravi (Carpenter)', email: 'ravi@fixon.com', phone: '6666666666', category: 'Maintenance', skills: ['Carpentry'], isAvailable: true, isActive: false, rating: 4.6, currentLocation: {} },
];
const DEMO_BOOKINGS = [
  { _id: 'b1', userId: DEMO_USERS[0], service: 'Plumbing Repair', category: 'Maintenance', price: 499, status: 'ongoing', scheduledTime: new Date().toISOString(), location: { address: '12 MG Road, Hyderabad', lat: 17.412, lng: 78.455 }, createdAt: new Date().toISOString() },
  { _id: 'b2', userId: DEMO_USERS[1], service: 'Deep Cleaning', category: 'Home Services', price: 1299, status: 'pending', scheduledTime: new Date().toISOString(), location: { address: '45 Banjara Hills, Hyderabad', lat: 17.395, lng: 78.500 }, createdAt: new Date().toISOString() },
  { _id: 'b3', userId: DEMO_USERS[2], service: 'Fan Repair', category: 'Maintenance', price: 299, status: 'accepted', scheduledTime: new Date(Date.now() + 3600000).toISOString(), location: { address: '78 Jubilee Hills, Hyderabad', lat: 17.360, lng: 78.480 }, createdAt: new Date().toISOString() },
  { _id: 'b4', userId: DEMO_USERS[0], service: 'AC Installation', category: 'Maintenance', price: 1500, status: 'completed', scheduledTime: new Date(Date.now() - 86400000).toISOString(), location: { address: '12 MG Road, Hyderabad', lat: 17.412, lng: 78.455 }, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { _id: 'b5', userId: DEMO_USERS[3], service: 'Pest Control', category: 'Cleaning', price: 999, status: 'cancelled', scheduledTime: new Date(Date.now() - 172800000).toISOString(), location: { address: '22 Kondapur, Hyderabad' }, createdAt: new Date(Date.now() - 172800000).toISOString() },
];
const DEMO_PAYMENTS = [
  { _id: 'p1', bookingId: 'b1', userId: DEMO_USERS[0], amount: 499, status: 'success', paymentMethod: 'UPI', createdAt: new Date().toISOString() },
  { _id: 'p2', bookingId: 'b4', userId: DEMO_USERS[0], amount: 1500, status: 'success', paymentMethod: 'Card', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { _id: 'p3', bookingId: 'b2', userId: DEMO_USERS[1], amount: 1299, status: 'pending', paymentMethod: 'UPI', createdAt: new Date().toISOString() },
  { _id: 'p4', bookingId: 'b5', userId: DEMO_USERS[3], amount: 999, status: 'failed', paymentMethod: 'Wallet', createdAt: new Date(Date.now() - 172800000).toISOString() },
];
const DEMO_STATS = {
  success: true,
  stats: { totalUsers: 4, totalWorkers: 4, totalBookings: 5, completedBookings: 1, pendingBookings: 1, activeBookings: 2, totalRevenue: 1999 },
  monthlyBookings: [
    { _id: { month: 1 }, count: 3 }, { _id: { month: 2 }, count: 5 }, { _id: { month: 3 }, count: 4 },
    { _id: { month: 4 }, count: 8 }, { _id: { month: 5 }, count: 6 }, { _id: { month: 6 }, count: 11 },
  ]
};

// ─── Wrapper: Real API → fallback to Demo ─────────────────
const safe = async (apiFn, demoData) => {
  try { return await apiFn(); } catch { return demoData; }
};

export const authApi = {
  login: (data) => api.post('/api/auth/admin/login', data),
};

// Cloud server (same as mobile apps — dynamically local or Render cloud)
const localApi = axios.create({ baseURL: BASE, timeout: 45000 });

// Helper for instant admin UI response with non-blocking dual-write
const dualWrite = async (localReqFn, cloudReqFn) => {
  let result = null;
  try {
    result = await localReqFn();
  } catch (err) {
    console.warn('Local API write fallback:', err.message);
  }

  if (result && result.success !== false) {
    cloudReqFn().catch(() => {});
    return result;
  } else {
    try {
      return await cloudReqFn();
    } catch (err) {
      return result || { success: false, error: err.message };
    }
  }
};

export const adminApi = {
  getStats:      async () => {
    try {
      const r = await localApi.get('/api/admin/stats');
      // Always use real server data when server is reachable (even if 0 users)
      if (r.data?.success) return r.data;
    } catch {}
    return DEMO_STATS;
  },
  getActivity:   () => safe(() => api.get('/api/admin/activity'), { success: true, recentBookings: DEMO_BOOKINGS }),
  getUsers:      async () => {
    let localUsers = [];
    let cloudUsers = [];

    try {
      const r = await localApi.get('/api/admin/users');
      if (r.data?.success && r.data.users) localUsers = r.data.users;
    } catch {}

    try {
      const r = await axios.get(`${CLOUD}/api/admin/users`, { timeout: 10000 });
      if (r.data?.success && r.data.users) cloudUsers = r.data.users;
    } catch {}

    const userMap = new Map();
    [...localUsers, ...cloudUsers].forEach(u => {
      if (u && u._id) userMap.set(u._id, u);
    });

    const merged = Array.from(userMap.values());
    if (merged.length > 0) return { success: true, users: merged };

    return { success: true, users: DEMO_USERS };
  },
  blockUser:     (id) => safe(() => api.patch(`/api/admin/users/${id}/block`), { success: true }),
  getWorkers:    async () => {
    let localW = [];
    let cloudW = [];
    try { const r = await localApi.get('/api/workers'); localW = r.data?.workers || []; } catch {}
    try { const r = await axios.get(`${CLOUD}/api/workers`, { timeout: 15000 }); cloudW = r.data?.workers || []; } catch {}
    const map = new Map();
    [...localW, ...cloudW].forEach(w => { if (w._id) map.set(w._id, w); });
    const merged = Array.from(map.values());
    if (merged.length > 0) return { success: true, workers: merged };
    return { success: true, workers: DEMO_WORKERS };
  },
  addWorker:     async (d) => {
    const r = await localApi.post('/api/workers', d).then(x => x.data);
    try { axios.post(`${CLOUD}/api/workers`, d, { timeout: 10000 }); } catch {}
    return r;
  },
  updateWorker:  async (id, d) => {
    const r = await localApi.put(`/api/workers/${id}`, d).then(x => x.data);
    try { axios.put(`${CLOUD}/api/workers/${id}`, d, { timeout: 10000 }); } catch {}
    return r;
  },
  deleteWorker:  async (id) => {
    const r = await localApi.delete(`/api/workers/${id}`).then(x => x.data);
    try { axios.delete(`${CLOUD}/api/workers/${id}`, { timeout: 10000 }); } catch {}
    return r;
  },
  toggleWorker:  async (id) => {
    const r = await localApi.patch(`/api/workers/${id}/toggle`).then(x => x.data);
    try { axios.patch(`${CLOUD}/api/workers/${id}/toggle`, {}, { timeout: 10000 }); } catch {}
    return r;
  },
  approveWorker: async (id) => {
    let r;
    try { r = await localApi.post(`/api/workers/${id}/approve`).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/workers/${id}/approve`, {}, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  rejectWorker: async (id, reason) => {
    let r;
    try { r = await localApi.post(`/api/workers/${id}/reject`, { reason }).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/workers/${id}/reject`, { reason }, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  blockWorker: async (id) => {
    let r;
    try { r = await localApi.post(`/api/workers/${id}/block`).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/workers/${id}/block`, {}, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  resetPassword: async (id) => {
    let r;
    try { r = await localApi.post(`/api/workers/${id}/reset-password`).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/workers/${id}/reset-password`, {}, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  approveAadhaar: async (id) => {
    let r;
    try { r = await localApi.post(`/api/workers/${id}/approve-aadhaar`).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/workers/${id}/approve-aadhaar`, {}, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  approvePan: async (id) => {
    let r;
    try { r = await localApi.post(`/api/workers/${id}/approve-pan`).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/workers/${id}/approve-pan`, {}, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },

  // Bookings — merge local server + Render cloud so admin sees ALL bookings (rank-guarded)
  getBookings: async () => {
    let localBookings = [];
    let cloudBookings = [];

    // 1. Try local server (if active)
    try {
      const localRes = await localApi.get('/api/bookings');
      localBookings = localRes.data?.bookings || [];
    } catch {}

    // 2. Try Render cloud (where mobile app creates bookings)
    try {
      const cloudRes = await axios.get(`${CLOUD}/api/bookings`, { timeout: 30000 });
      cloudBookings = cloudRes.data?.bookings || [];
    } catch {}

    const ranks = {
      pending: 0, assigned: 1, accepted: 2, confirmed: 2,
      on_the_way: 3, arrived: 4, ongoing: 5, in_progress: 5, started: 5,
      completed: 6, cancelled: 99
    };
    const norm = (s) => {
      if (!s) return 'pending';
      const str = String(s).trim().toLowerCase().replace(/[\s-]/g, '_');
      if (['confirmed', 'accepted', 'accept'].includes(str)) return 'accepted';
      if (['on_the_way', 'ontheway', 'on_way', 'on-the-way'].includes(str)) return 'on_the_way';
      if (['arrived', 'arrive'].includes(str)) return 'arrived';
      if (['ongoing', 'in_progress', 'start_work', 'started', 'start', 'working'].includes(str)) return 'ongoing';
      if (['completed', 'complete', 'finish', 'finished', 'done'].includes(str)) return 'completed';
      if (['cancelled', 'cancel'].includes(str)) return 'cancelled';
      return str;
    };

    // 3. Merge by _id (higher status rank ALWAYS wins, never regress status)
    const map = new Map();
    [...localBookings, ...cloudBookings].forEach(b => {
      if (!b || !b._id) return;
      if (!map.has(b._id)) {
        map.set(b._id, b);
      } else {
        const existing = map.get(b._id);
        const existingRank = ranks[norm(existing.status)] ?? 0;
        const newRank = ranks[norm(b.status)] ?? 0;
        // Keep whichever record has higher rank; on tie, local/cloud with photos takes precedence
        if (newRank > existingRank || (newRank === existingRank && (b.workerBeforePhoto || b.workerAfterPhoto))) {
          map.set(b._id, b);
        }
      }
    });

    const merged = Array.from(map.values());
    if (merged.length > 0) {
      merged.sort((a, b) => new Date(b.createdAt || b.scheduledTime || Date.now()) - new Date(a.createdAt || a.scheduledTime || Date.now()));
      return { success: true, bookings: merged };
    }

    // 4. Absolute fallback: demo data
    return { success: true, bookings: DEMO_BOOKINGS };
  },

  updateBooking: (id, d) => dualWrite(
    () => localApi.put(`/api/bookings/${id}/status`, d).then(x => x.data),
    () => axios.put(`${CLOUD}/api/bookings/${id}/status`, d, { timeout: 8000 }).then(x => x.data)
  ),

  confirmBooking: (id, workerId, workerName) => {
    const body = { status: 'accepted', workerId, workerName };
    return dualWrite(
      () => localApi.put(`/api/bookings/${id}/status`, body).then(x => x.data),
      () => axios.put(`${CLOUD}/api/bookings/${id}/status`, body, { timeout: 8000 }).then(x => x.data)
    );
  },

  assignWorker: (bId, wId, wName) => {
    const body = { status: 'accepted', workerId: wId, workerName: wName };
    return dualWrite(
      () => localApi.put(`/api/bookings/${bId}/status`, body).then(x => x.data),
      () => axios.put(`${CLOUD}/api/bookings/${bId}/status`, body, { timeout: 8000 }).then(x => x.data)
    );
  },
  getPayments:   () => safe(() => api.get('/api/payment/all'),    { success: true, payments: DEMO_PAYMENTS }),
  // Chat — merge from local + Render cloud (admin always sees messages regardless of where they were sent from)
  getMessages: async () => {
    let localMsgs = [];
    let cloudMsgs = [];

    try {
      const r = await localApi.get('/api/chat/all');
      if (r.data?.success && r.data.messages) localMsgs = r.data.messages;
    } catch {}

    try {
      const r = await axios.get(`${CLOUD}/api/chat/all`, { timeout: 12000 });
      if (r.data?.success && r.data.messages) cloudMsgs = r.data.messages;
    } catch {}

    // Merge: deduplicate by createdAt+senderId+message combo, prefer cloud version
    const seen = new Set();
    const merged = [];
    [...localMsgs, ...cloudMsgs].forEach(m => {
      const key = `${m.senderId}|${m.receiverId}|${m.createdAt}|${m.message?.slice(0, 30)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(m);
      }
    });

    // Sort chronologically
    merged.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    return { success: true, messages: merged };
  },

  sendMessage: async (d) => {
    let r;
    try { r = await localApi.post('/api/chat/admin-reply', d).then(x => x.data); } catch {}
    try { await axios.post(`${CLOUD}/api/chat/admin-reply`, d, { timeout: 8000 }); } catch {}
    return r || { success: true };
  },
  sendNotification: async (d) => {
    let r;
    try { r = await localApi.post('/api/notifications/send', d).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/notifications/send`, d, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  getServices:   () => localApi.get('/api/admin/services').then(r => r.data).catch(() => ({ success: true, services: [] })),

  addService: async (d) => {
    // Write to local server (saves to MongoDB)
    const r = await localApi.post('/api/admin/services', d).then(x => x.data);
    // Immediately also write same data directly to Render cloud (no timing gap)
    try { axios.post(`${CLOUD}/api/admin/services`, d, { timeout: 10000 }); } catch {}
    return r;
  },

  updateService: async (id, d) => {
    // Write to local server first (saves to MongoDB)
    const r = await localApi.put(`/api/admin/services/${id}`, d).then(x => x.data);
    // Immediately push SAME data directly to Render — no MongoDB read delay
    try { axios.put(`${CLOUD}/api/admin/services/${id}`, d, { timeout: 10000 }); } catch {}
    return r;
  },

  deleteService: async (id) => {
    const r = await localApi.delete(`/api/admin/services/${id}`).then(x => x.data);
    try { axios.delete(`${CLOUD}/api/admin/services/${id}`, { timeout: 10000 }); } catch {}
    return r;
  },
  getCoupons: async () => {
    let localC = [];
    let cloudC = [];
    try { const r = await localApi.get('/api/coupons'); if (r.data?.success) localC = r.data.coupons || []; } catch {}
    try { const r = await axios.get(`${CLOUD}/api/coupons`, { timeout: 10000 }); if (r.data?.success) cloudC = r.data.coupons || []; } catch {}

    const map = new Map();
    [...localC, ...cloudC].forEach(c => { if (c && (c._id || c.code)) map.set(c._id || c.code, c); });
    const merged = Array.from(map.values());
    if (merged.length > 0) return { success: true, coupons: merged };
    return { success: true, coupons: [] };
  },
  addCoupon: async (d) => {
    let r;
    try { r = await localApi.post('/api/coupons', d).then(x => x.data); } catch {}
    try { const c = await axios.post(`${CLOUD}/api/coupons`, d, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  toggleCoupon: async (id) => {
    let r;
    try { r = await localApi.put(`/api/coupons/${id}/toggle`).then(x => x.data); } catch {}
    try { const c = await axios.put(`${CLOUD}/api/coupons/${id}/toggle`, {}, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  deleteCoupon: async (id) => {
    let r;
    try { r = await localApi.delete(`/api/coupons/${id}`).then(x => x.data); } catch {}
    try { const c = await axios.delete(`${CLOUD}/api/coupons/${id}`, { timeout: 10000 }); if (!r) r = c.data; } catch {}
    return r || { success: true };
  },
  getAnalytics:  () => safe(() => api.get('/api/admin/analytics'), { success: true }),
  getSettings:   () => safe(() => api.get('/api/admin/settings'), { success: true }),
  saveSettings:  (d) => safe(() => api.post('/api/admin/settings', d), { success: true }),

  // Syllabus 17.1: User count sync
  getUserCount: () => localApi.get('/api/admin/users/count').then(r => r.data).catch(() => ({ success: false })),

  // Syllabus 18.3: Customer list
  getAdminUsers: () => localApi.get('/api/admin/users').then(r => r.data).catch(() => ({ success: false })),

  // Customer count fallback compatibility
  getCustomerStats: () => localApi.get('/api/admin/users/count').then(r => r.data).catch(() => ({ success: true, totalUsers: 0, activeUsers: 0 })),

  // Live customer locations — merge from Render cloud AND local server
  getLiveLocations: async () => {
    let cloudCusts = [];
    let localCusts = [];
    try {
      const r = await axios.get(`${CLOUD}/api/location/customers`, { timeout: 15000 });
      if (r.data?.success && r.data.customers) cloudCusts = r.data.customers;
    } catch {}
    try {
      const r = await localApi.get('/api/location/customers');
      if (r.data?.success && r.data.customers) localCusts = r.data.customers;
    } catch {}

    const map = new Map();
    [...localCusts, ...cloudCusts].forEach(c => {
      const key = c.userId || c._id;
      if (key) map.set(key, c);
    });

    return { success: true, customers: Array.from(map.values()) };
  },

  // Payout data — all workers
  getPayouts: () => localApi.get('/api/admin/payouts').then(r => r.data).catch(() => ({ success: true, payouts: [] })),

  // Per-worker payout detail
  getWorkerPayout: (workerId) => localApi.get(`/api/workers/${workerId}/payouts`).then(r => r.data).catch(() => ({ success: false })),

  // Per-worker ratings
  getWorkerRatings: (workerId) => localApi.get(`/api/ratings/worker/${workerId}`).then(r => r.data).catch(() => ({ success: true, ratings: [] })),

  // Invoice for a booking
  getInvoice: (bookingId) => localApi.get(`/api/bookings/${bookingId}/invoice`).then(r => r.data).catch(() => ({ success: false })),

};

