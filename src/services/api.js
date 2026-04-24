import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: BASE, timeout: 5000 });

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

// Local chat/tracking server (always port 5000)
const localApi = axios.create({ baseURL: 'http://localhost:5000', timeout: 5000 });

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
    try {
      const r = await localApi.get('/api/admin/users');
      // Always use real server data when server is reachable
      if (r.data?.success) return r.data;
    } catch {}
    return { success: true, users: DEMO_USERS };
  },
  blockUser:     (id) => safe(() => api.patch(`/api/admin/users/${id}/block`), { success: true }),
  getWorkers:    () => safe(() => api.get('/api/workers'),        { success: true, workers: DEMO_WORKERS }),
  addWorker:     (d) => safe(() => api.post('/api/workers', d),   { success: true }),
  updateWorker:  (id, d) => safe(() => api.put(`/api/workers/${id}`, d), { success: true }),
  deleteWorker:  (id) => safe(() => api.delete(`/api/workers/${id}`), { success: true }),
  toggleWorker:  (id) => safe(() => api.patch(`/api/workers/${id}/toggle`), { success: true }),

  // Bookings — local server is source of truth; demo only if both fail AND local is empty
  getBookings: async () => {
    try {
      // Always try local server first (real bookings from mobile)
      const localRes = await localApi.get('/api/bookings');
      const localBookings = localRes.data?.bookings || localRes.data || [];
      if (localBookings.length > 0) {
        return { success: true, bookings: localBookings };
      }
    } catch {}
    // Local server returned nothing — try external API, then demo
    return safe(() => api.get('/api/bookings/all'), { success: true, bookings: DEMO_BOOKINGS });
  },

  updateBooking: (id, d) => {
    // Try local server first, then external
    return localApi.put(`/api/bookings/${id}/status`, d)
      .then(r => r.data)
      .catch(() => safe(() => api.patch(`/api/bookings/${id}`, d), { success: true }));
  },

  confirmBooking: (id, workerId, workerName) => {
    return localApi.put(`/api/bookings/${id}/status`, { status: 'accepted', workerId, workerName })
      .then(r => r.data)
      .catch(() => safe(() => api.patch(`/api/bookings/${id}`, { status: 'accepted' }), { success: true }));
  },

  assignWorker:  (bId, wId) => safe(() => api.patch(`/api/bookings/${bId}/assign`, { workerId: wId }), { success: true }),
  getPayments:   () => safe(() => api.get('/api/payment/all'),    { success: true, payments: DEMO_PAYMENTS }),
  // Chat always uses local server — messages live here
  getMessages:   async () => {
    try {
      const r = await localApi.get('/api/chat/all');
      if (r.data?.success) return r.data;
    } catch {}
    return { success: true, messages: [] };
  },
  sendMessage:   (d) => localApi.post('/api/chat/admin-reply', d).then(r => r.data).catch(() => safe(() => api.post('/api/chat/admin-reply', d), { success: true })),
  sendNotification: (d) => safe(() => api.post('/api/notifications/send', d), { success: true }),
  getServices:   () => safe(() => api.get('/api/admin/services'), { success: true, services: [] }),
  addService:    (d) => safe(() => api.post('/api/admin/services', d), { success: true }),
  updateService: (id, d) => safe(() => api.put(`/api/admin/services/${id}`, d), { success: true }),
  deleteService: (id) => safe(() => api.delete(`/api/admin/services/${id}`), { success: true }),
  getCoupons:    () => safe(() => api.get('/api/admin/coupons'),  { success: true, coupons: [] }),
  addCoupon:     (d) => safe(() => api.post('/api/admin/coupons', d), { success: true }),
  toggleCoupon:  (id) => safe(() => api.patch(`/api/admin/coupons/${id}/toggle`), { success: true }),
  deleteCoupon:  (id) => safe(() => api.delete(`/api/admin/coupons/${id}`), { success: true }),
  getAnalytics:  () => safe(() => api.get('/api/admin/analytics'), { success: true }),
  getSettings:   () => safe(() => api.get('/api/admin/settings'), { success: true }),
  saveSettings:  (d) => safe(() => api.post('/api/admin/settings', d), { success: true }),

  // Syllabus 17.1: User count sync
  getUserCount: () => localApi.get('/api/admin/users/count').then(r => r.data).catch(() => ({ success: false })),

  // Syllabus 18.3: Customer list
  getAdminUsers: () => localApi.get('/api/admin/users').then(r => r.data).catch(() => ({ success: false })),

  // Customer count fallback compatibility
  getCustomerStats: () => localApi.get('/api/admin/users/count').then(r => r.data).catch(() => ({ success: true, totalUsers: 0, activeUsers: 0 })),

  // Live customer locations from local server
  getLiveLocations: () => localApi.get('/api/location/customers').then(r => r.data).catch(() => ({ success: true, customers: [] })),
};

