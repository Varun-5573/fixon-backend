const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] }
});

// ── Persistent file storage ──────────────────────────────────
const DATA_FILE = path.join(__dirname, 'fixon_data.json');

// ── In-memory stores (declared HERE so loadData() can write to them) ──
const users = {};           // userId → live location tracking
const workers = {};         // workerId → { _id, name, lat, lng } (live location)
let messages = [];
let bookings = [];
let registeredUsers = [];   // real sign-ups
let notificationsList = []; // admin sent notifications
let adminWorkers = [
  { _id: 'W_DEFAULT_1', name: 'Raju Kumar',       phone: '9876543210', email: 'raju@fixon.com',   category: 'Plumbing',   skills: ['Plumbing','Pipe Repair','Bathroom','Leak Fix'],         rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_PLM_1001', workerPassword: 'FXN1001', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_2', name: 'Srinivas Rao',     phone: '9876543211', email: 'srini@fixon.com',  category: 'Electrical', skills: ['Electrical','Wiring','Fan Installation','Switch Repair'],  rating: 4.7, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '7 years',  workerId: 'FIXON_ELC_1001', workerPassword: 'FXN1002', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_3', name: 'Prasad Cleaning',  phone: '9876543212', email: 'prasad@fixon.com', category: 'Cleaning',   skills: ['Cleaning','Deep Cleaning','Pest Control','Home Services'], rating: 4.6, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '3 years',  workerId: 'FIXON_CLN_1001', workerPassword: 'FXN1003', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_4', name: 'Vijay Tech',       phone: '9876543213', email: 'vijay@fixon.com',  category: 'AC Repair',  skills: ['AC Repair','AC Service','CCTV Installation','Appliances'],  rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '8 years',  workerId: 'FIXON_ACR_1001', workerPassword: 'FXN1004', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_5', name: 'Mahesh Carpenter', phone: '9876543214', email: 'mahesh@fixon.com', category: 'Carpentry',  skills: ['Carpentry','Painting','Furniture','Wood Work'],            rating: 4.5, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_CRP_1001', workerPassword: 'FXN1005', createdAt: new Date().toISOString() },
];
let services = [
  { _id: 'SV1', name: 'Plumbing',     icon: '🔧', color: '#7C3AED', price: 499,  active: true, packages: [{name: 'Leaky Tap Repair', price: 499}, {name: 'Full Bathroom Polish', price: 1499}] },
  { _id: 'SV2', name: 'Electrical',   icon: '⚡', color: '#F59E0B', price: 599,  active: true, packages: [{name: 'Single Point Fix', price: 599}, {name: 'Home Safety Check', price: 1999}] },
  { _id: 'SV3', name: 'Cleaning',     icon: '🧹', color: '#10B981', price: 1299, active: true, packages: [{name: '1 BHK', price: 1299}, {name: '2 BHK', price: 2199}, {name: 'Villa', price: 4999}] },
  { _id: 'SV4', name: 'AC Repair',    icon: '❄️', color: '#06B6D4', price: 799,  active: true, packages: [{name: 'Basic Service', price: 799}, {name: 'Gas Refill & Check', price: 2499}] },
  { _id: 'SV5', name: 'Carpentry',    icon: '🪚', color: '#EC4899', price: 699,  active: true, packages: [] },
  { _id: 'SV6', name: 'Painting',     icon: '🎨', color: '#EF4444', price: 2499, active: true, packages: [] },
  { _id: 'SV7', name: 'Pest Control', icon: '🐛', color: '#8B5CF6', price: 999,  active: true, packages: [] },
  { _id: 'SV8', name: 'CCTV Setup',   icon: '📹', color: '#059669', price: 3499, active: true, packages: [] },
];
let coupons = [
  { _id: 'CP1', code: 'FIXON10',  discount: 10, type: 'percent', minOrder: 300, expiry: '2026-12-31', active: true, used: 0 },
  { _id: 'CP2', code: 'FIRST50',  discount: 50, type: 'flat',    minOrder: 200, expiry: '2026-12-31', active: true, used: 0 },
  { _id: 'CP3', code: 'SUMMER25', discount: 25, type: 'percent', minOrder: 500, expiry: '2026-12-31', active: true, used: 0 },
];

async function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const text = fs.readFileSync(DATA_FILE, 'utf-8');
      if (text && text.trim() !== '') {
        const parsed = JSON.parse(text);
        if (parsed.users) Object.assign(users, parsed.users);
        if (parsed.bookings) bookings = parsed.bookings;
        if (parsed.messages) messages = parsed.messages;
        if (parsed.registeredUsers) registeredUsers = parsed.registeredUsers;
        if (parsed.notificationsList) notificationsList = parsed.notificationsList;
        // Only load saved workers if there are any; keep defaults otherwise
        if (parsed.adminWorkers && parsed.adminWorkers.length > 0) {
          adminWorkers = parsed.adminWorkers;
        }
        if (parsed.services && parsed.services.length > 0) services = parsed.services;
        if (parsed.coupons && parsed.coupons.length > 0) coupons = parsed.coupons;
      }
    }
  } catch (error) {
    console.error('🔥 Local Data Load Error:', error);
  }

  // Always ensure default workers have their credentials (survives auto-save overwrites)
  const DEFAULT_CREDS = {
    'W_DEFAULT_1': { workerId:'FIXON_PLM_1001', workerPassword:'FXN1001' },
    'W_DEFAULT_2': { workerId:'FIXON_ELC_1001', workerPassword:'FXN1002' },
    'W_DEFAULT_3': { workerId:'FIXON_CLN_1001', workerPassword:'FXN1003' },
    'W_DEFAULT_4': { workerId:'FIXON_ACR_1001', workerPassword:'FXN1004' },
    'W_DEFAULT_5': { workerId:'FIXON_CRP_1001', workerPassword:'FXN1005' },
  };
  adminWorkers = adminWorkers.map(w => {
    const cred = DEFAULT_CREDS[w._id];
    if (cred && !w.workerId) return { ...w, ...cred, isOnline: w.isOnline || false };
    return w;
  });
  console.log('✅ Workers loaded:', adminWorkers.length, '| Credentialed:', adminWorkers.filter(w=>w.workerId).length);
}


async function saveData() {
  try {
    const dataObj = { users, bookings, messages, registeredUsers, notificationsList, adminWorkers, services, coupons };
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf-8');
  } catch (error) {
    console.error('🔥 Local Data Save Error:', error);
  }
}

// Ensure loadData runs before starting the server
loadData().then(() => {
  console.log('🔥 Initial Firebase data loaded!');
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 FixoN Server running at port ${PORT}`);
    console.log(`   Socket.IO ready for real-time tracking ⚡\n`);
  });
}).catch(err => {
  console.error('❌ Failed to load initial data:', err);
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server started (Fallback Mode) on port ${PORT}`));
});

// Auto-save every 30 seconds
setInterval(saveData, 30000);

// ── Smart Bot auto-responder ───────────────────────────────
const BOT_RULES = [
  { keywords: ['booking', 'book', 'schedule', 'cancel'],
    reply: '📅 For booking issues, you can view or cancel your bookings in the "My Bookings" tab. Need something specific?' },
  { keywords: ['payment', 'pay', 'charge', 'refund', 'money'],
    reply: '💳 Payments are processed securely. Refunds take 3-5 business days. Would you like to speak with an admin?' },
  { keywords: ['worker', 'technician', 'plumber', 'electrician', 'late', 'delay'],
    reply: '👷 I understand your concern! Our team is tracking the worker\'s location. An admin will update you shortly.' },
  { keywords: ['price', 'cost', 'charge', 'expensive', 'how much'],
    reply: '💰 All prices are listed transparently in the app. No hidden charges ever! Visit Services to see pricing.' },
  { keywords: ['hello', 'hi', 'hey', 'help', 'hii'],
    reply: '👋 Hello! Welcome to FixoN Support. How can I help you today? You can ask me about bookings, payments, or services!' },
  { keywords: ['thank', 'thanks', 'okay', 'ok', 'great'],
    reply: '😊 You\'re welcome! Is there anything else I can help you with?' },
  { keywords: ['location', 'track', 'where', 'gps'],
    reply: '📍 Your location is being tracked in real-time. Our admin can see your position to assign the nearest worker!' },
];

function getBotReply(message) {
  const lower = message.toLowerCase();
  for (const rule of BOT_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.reply;
  }
  return '🤖 I\'ve received your message and forwarded it to our support team. An admin will respond shortly! You can also call us at 1800-FIXON-00.';
}

// ══════════════════════════════════════════════════════════════
//  USER AUTH ROUTES (mobile app register / login)
// ══════════════════════════════════════════════════════════════

// Register a new user — called from mobile signup
app.post('/api/auth/user/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email) return res.status(400).json({ success: false, error: 'Name and email required' });

  // Check if already registered
  const existing = registeredUsers.find(u => u.email === email);
  if (existing) {
    return res.json({ success: true, token: 'local_' + existing._id, user: existing, message: 'Already registered' });
  }

  const userId = 'U' + Date.now();
  const newUser = {
    _id: userId,
    name,
    email,
    phone: phone || '',
    password, // stored plain for demo (use bcrypt in production)
    isBlocked: false,
    totalBookings: 0,
    createdAt: new Date().toISOString(),
    location: {},
  };
  registeredUsers.push(newUser);
  saveData();  // persist immediately

  io.emit('new_user', newUser);
  console.log(`🆕 New user registered: ${name} (${email})`);
  res.json({ success: true, token: 'local_' + userId, user: newUser });
});

// Login — called from mobile login screen
app.post('/api/auth/user/login', (req, res) => {
  const { email, password } = req.body;
  const user = registeredUsers.find(u => u.email === email);
  if (!user) return res.status(401).json({ success: false, error: 'User not found' });
  if (user.password !== password) return res.status(401).json({ success: false, error: 'Wrong password' });
  res.json({ success: true, token: 'local_' + user._id, user });
});

// Admin: get all registered, active, and chatting users
app.get('/api/admin/users', (req, res) => {
  const userMap = {};

  // 1. Populate registered users
  registeredUsers.forEach(u => {
    userMap[u._id] = {
      ...u,
      location: users[u._id] ? { lat: users[u._id].lat, lng: users[u._id].lng } : (u.location || {}),
      totalBookings: bookings.filter(b => b.userId?._id === u._id).length,
    };
  });

  // 2. Add active users (live location tracks)
  Object.values(users).forEach(u => {
    if (!userMap[u._id]) {
      userMap[u._id] = {
        _id: u._id,
        name: u.name || 'Customer',
        email: u.email || '',
        phone: u.phone || '',
        location: { lat: u.lat, lng: u.lng },
        totalBookings: bookings.filter(b => b.userId?._id === u._id).length,
        isBlocked: false,
        createdAt: u.lastSeen || new Date().toISOString(),
      };
    }
  });

  // 3. Add chatting users from messages history
  messages.forEach(m => {
    const senderId = m.senderId;
    if (senderId && senderId !== 'admin' && senderId !== 'bot' && !userMap[senderId]) {
      userMap[senderId] = {
        _id: senderId,
        name: m.name || ('Customer ' + senderId.slice(-4)),
        email: senderId + '@fixon.com',
        phone: '',
        location: users[senderId] ? { lat: users[senderId].lat, lng: users[senderId].lng } : {},
        totalBookings: bookings.filter(b => b.userId?._id === senderId).length,
        isBlocked: false,
        createdAt: m.createdAt || new Date().toISOString(),
      };
    }
  });

  res.json({ success: true, users: Object.values(userMap) });
});

// Admin: get user count
app.get('/api/admin/users/count', (req, res) => {
  res.json({
    success: true,
    totalUsers: registeredUsers.length,
    activeUsers: Object.keys(users).length,
    newUsersToday: registeredUsers.filter(u => new Date(u.createdAt).toDateString() === new Date().toDateString()).length
  });
});

// Admin: get stats
app.get('/api/admin/stats', (req, res) => {
  const completed = bookings.filter(b => b.status === 'completed').length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const revenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.price || 0), 0);
  res.json({
    success: true,
    stats: {
      totalUsers: registeredUsers.length,
      totalWorkers: 0,
      totalBookings: bookings.length,
      completedBookings: completed,
      pendingBookings: pending,
      activeBookings: bookings.filter(b => ['accepted','ongoing'].includes(b.status)).length,
      totalRevenue: revenue,
    }
  });
});

// ══════════════════════════════════════════════════════════════
//  LOCATION ROUTES
// ══════════════════════════════════════════════════════════════

// Customer pushes live location
app.post('/api/location/update', (req, res) => {
  const { userId, lat, lng, address, name, email } = req.body;
  if (!userId || !lat || !lng) return res.status(400).json({ success: false, error: 'Missing fields' });

  if (!users[userId]) {
    // 🔍 Look up real name from registeredUsers array
    const realUser = registeredUsers.find(u => u._id === userId);
    users[userId] = { 
       _id: userId, 
       name: name || realUser?.name || 'Customer', 
       email: email || realUser?.email || '' 
    };
    io.emit('new_user', users[userId]);
    console.log(`👤 New customer registered: ${users[userId].name}`);
  }
  users[userId].lat = parseFloat(lat);
  users[userId].lng = parseFloat(lng);
  users[userId].address = address || '';
  users[userId].lastSeen = new Date().toISOString();

  // Broadcast live location to admin map
  io.emit('user_location', {
    userId,
    name: users[userId].name,
    lat: users[userId].lat,
    lng: users[userId].lng,
    address: users[userId].address,
  });

  console.log(`📍 Location update: ${users[userId].name} → ${lat}, ${lng}`);
  res.json({ success: true });
});

// Worker pushes live location
app.post('/api/location/worker', (req, res) => {
  const { workerId, lat, lng } = req.body;
  if (!workerId) return res.status(400).json({ success: false });

  if (!workers[workerId]) workers[workerId] = { _id: workerId };
  workers[workerId].lat = parseFloat(lat);
  workers[workerId].lng = parseFloat(lng);

  io.emit('worker_location', { workerId, lat: workers[workerId].lat, lng: workers[workerId].lng });
  res.json({ success: true });
});

// Admin: get all live customer locations
app.get('/api/location/customers', (req, res) => {
  res.json({ success: true, customers: Object.values(users).filter(u => u.lat) });
});

// ══════════════════════════════════════════════════════════════
//  BOOKING ROUTES (for mobile app — no separate backend)
// ══════════════════════════════════════════════════════════════

// Mobile app creates a booking  /  Admin seed import
app.post('/api/bookings', (req, res) => {
  const {
    userId, service, price, category, scheduledTime, lat, lng, address, name,
    // Extended fields from seed/admin:
    status, workerId, workerName, city, discount, couponCode,
    rating, ratingComment, completedAt, description,
    userName, userPhone,
  } = req.body;

  // Resolve user name
  const realUser = registeredUsers.find(u => u._id === userId);
  const finalName = userName || name || realUser?.name || users[userId]?.name || 'Customer';

  // Register user in live map if not seen
  if (userId && !users[userId]) {
    users[userId] = { _id: userId, name: finalName, email: realUser?.email || '' };
  }

  const booking = {
    _id: 'BK' + Date.now(),
    userId: userId ? { _id: userId, name: finalName } : { _id: 'guest', name: finalName },
    userName: finalName,
    userPhone: userPhone || realUser?.phone || '',
    service,
    description: description || '',
    price: price || 0,
    category: category || service,
    city: city || 'Hyderabad',
    scheduledTime: scheduledTime || new Date().toISOString(),
    status: status || 'pending',
    location: { lat: lat || null, lng: lng || null, address: address || '' },
    workerId: workerId ? { _id: workerId, name: workerName || 'Worker' } : null,
    workerName: workerName || null,
    discount: discount || 0,
    couponCode: couponCode || null,
    rating: rating || null,
    ratingComment: ratingComment || null,
    createdAt: req.body.createdAt || new Date().toISOString(),
    completedAt: completedAt || (status === 'completed' ? new Date().toISOString() : null),
  };

  bookings.push(booking);
  saveData();

  io.emit('new_booking', booking);
  console.log(`📦 Booking [${booking.status}]: ${booking.service} by ${finalName}`);

  res.json({ success: true, booking });
});


// Mobile app: get user's bookings
app.get('/api/bookings/user/:userId', (req, res) => {
  const userBookings = bookings.filter(b => b.userId?._id === req.params.userId);
  res.json({ success: true, bookings: userBookings.reverse() });
});

// Admin: update booking status
app.put('/api/bookings/:id/status', (req, res) => {
  const { status, workerId, workerName } = req.body;
  const b = bookings.find(b => b._id === req.params.id);
  if (!b) return res.status(404).json({ success: false });

  b.status = status;
  if (workerId) b.workerId = { _id: workerId, name: workerName || 'Worker' };
  saveData();

  io.emit('booking_update', { bookingId: b._id, status, booking: b });
  console.log(`🔄 Booking ${b._id} → ${status}`);

  // ── Notify the assigned worker when admin confirms ──────────
  if (status === 'accepted' && workerId) {
    const assignedWorker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
    const workerNotif = {
      _id: 'WN' + Date.now(),
      workerId: workerId,
      title: '🎉 New Booking Assigned!',
      message: `You have a new ${b.service} job assigned by admin. Please check your app.`,
      type: 'new_booking',
      bookingId: b._id,
      booking: b,
      createdAt: new Date().toISOString(),
      read: false,
    };
    notificationsList.push(workerNotif);

    // Emit directly to worker so app can show local notification
    io.emit('new_booking_assigned', {
      workerId: workerId,
      booking: b,
      notification: workerNotif,
    });
    console.log(`🔔 Worker ${assignedWorker?.name || workerId} notified about booking ${b._id}`);
  }

  // ── Notify customer that their booking was confirmed ────────
  if (status === 'accepted') {
    const customerId = b.userId?._id || b.userId;
    if (customerId) {
      const custNotif = {
        _id: 'N' + Date.now(),
        userId: customerId,
        title: '✅ Booking Confirmed!',
        message: `Your ${b.service} booking has been confirmed. Worker is on the way!`,
        type: 'booking',
        bookingId: b._id,
        createdAt: new Date().toISOString(),
        read: false,
      };
      notificationsList.push(custNotif);
      io.emit('new_notification', custNotif);
    }
  }

  res.json({ success: true, booking: b });
});

// Admin: get all bookings (local + merged with external)
app.get('/api/bookings', (req, res) => {
  res.json({ success: true, bookings: bookings.slice().reverse() });
});

// ══════════════════════════════════════════════════════════════
//  SYLLABUS STRICT ALIASING ROUTES (SECTION 17)
// ══════════════════════════════════════════════════════════════

// 17.1: GET /api/admin/users/count
app.get('/api/admin/users/count', (req, res) => {
  const newToday = registeredUsers.filter(u => new Date(u.createdAt) > new Date(Date.now() - 86400000)).length;
  res.json({
    success: true,
    totalUsers: registeredUsers.length,
    activeUsers: registeredUsers.filter(u => users[u._id]?.lat).length,
    newUsersToday: newToday
  });
});

// 17.2: GET /api/admin/bookings
app.get('/api/admin/bookings', (req, res) => {
  res.json({ success: true, bookings: bookings.slice().reverse() });
});

// 17.2: POST /api/bookings/create
app.post('/api/bookings/create', (req, res) => {
  // Pass to original handler logic
  req.url = '/api/bookings';
  app._router.handle(req, res, () => {});
});

// 17.5: PATCH /api/bookings/{id} 
app.patch('/api/bookings/:id', (req, res) => {
  const { status } = req.body;
  const b = bookings.find(b => b._id === req.params.id);
  if (!b) return res.status(404).json({ success: false });
  // Map "Confirmed" to internal "accepted" flag for UI consistency, or directly use status
  b.status = status === 'Confirmed' ? 'accepted' : status;
  io.emit('booking_update', { bookingId: b._id, status, booking: b });
  res.json({ success: true, booking: b });
});

// ══════════════════════════════════════════════════════════════
//  STATS ROUTES
// ══════════════════════════════════════════════════════════════

app.get('/api/stats/customers', (req, res) => {
  res.json({
    success: true,
    total: Object.keys(users).length,
    active: Object.values(users).filter(u => u.lat).length,
    users: Object.values(users),
  });
});

// ══════════════════════════════════════════════════════════════
//  WORKERS ROUTES (Admin Panel CRUD)
// ══════════════════════════════════════════════════════════════

app.get('/api/workers', (req, res) => {
  res.json({ success: true, workers: adminWorkers });
});

app.post('/api/workers', (req, res) => {
  const w = { _id: 'W' + Date.now(), ...req.body, active: true, createdAt: new Date().toISOString() };
  adminWorkers.push(w);
  saveData();
  io.emit('worker_added', w);
  res.json({ success: true, worker: w });
});

app.put('/api/workers/:id', (req, res) => {
  const idx = adminWorkers.findIndex(w => w._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });

  const prev = adminWorkers[idx];
  const updated = { ...prev, ...req.body };

  // Auto-generate Worker ID + Password when activating for the first time
  if (req.body.active === true && !prev.workerPassword) {
    const sameCatCount = adminWorkers.filter(
      (w, i) => i < idx && w.category === (updated.category || prev.category)
    ).length;
    const creds = generateWorkerCredentials(updated.category || prev.category, sameCatCount);
    updated.workerId = creds.workerId;
    updated.workerPassword = creds.password;
    updated.credentialsGeneratedAt = new Date().toISOString();
    console.log(`🔑 Credentials generated for ${updated.name}: ID=${creds.workerId} Pass=${creds.password}`);
  }

  adminWorkers[idx] = updated;
  saveData();
  io.emit('worker_updated', adminWorkers[idx]);
  res.json({ success: true, worker: adminWorkers[idx] });
});


app.delete('/api/workers/:id', (req, res) => {
  adminWorkers = adminWorkers.filter(w => w._id !== req.params.id);
  saveData();
  res.json({ success: true });
});

app.patch('/api/workers/:id/toggle', (req, res) => {
  const w = adminWorkers.find(w => w._id === req.params.id);
  if (!w) return res.status(404).json({ success: false });
  w.active = !w.active;
  w.isActive = !w.isActive;
  saveData();
  res.json({ success: true, worker: w });
});

// ══════════════════════════════════════════════════════════════
//  WORKER PAYOUT ROUTE
// ══════════════════════════════════════════════════════════════

app.get('/api/workers/:id/payouts', (req, res) => {
  const workerId = req.params.id;
  const worker = adminWorkers.find(w => w._id === workerId);
  if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

  // Match bookings where workerId matches (handle both string and object forms)
  const workerBookings = bookings.filter(b =>
    b.status === 'completed' && (
      b.workerId === workerId ||
      b.workerId?._id === workerId ||
      b.workerId === worker.name
    )
  );

  const totalRevenue = workerBookings.reduce((s, b) => s + (b.price || 0), 0);
  const totalEarnings = Math.round(totalRevenue * 0.7);
  const platformCut   = Math.round(totalRevenue * 0.3);
  const averagePerJob = workerBookings.length ? Math.round(totalEarnings / workerBookings.length) : 0;

  res.json({
    success: true,
    workerId,
    workerName: worker.name,
    totalJobs: workerBookings.length,
    totalRevenue,
    totalEarnings,
    platformCut,
    averagePerJob,
    bookings: workerBookings.map(b => ({
      _id: b._id,
      service: b.service,
      price: b.price,
      workerEarning: Math.round((b.price || 0) * 0.7),
      date: b.completedAt || b.createdAt,
    })),
  });
});

// ══════════════════════════════════════════════════════════════
//  RATINGS ROUTES
// ══════════════════════════════════════════════════════════════

let ratings = []; // { _id, bookingId, workerId, rating, comment, createdAt }

// Customer submits a rating after booking completion
app.post('/api/ratings', (req, res) => {
  const { bookingId, workerId, rating, comment } = req.body;
  if (!bookingId || !workerId || !rating) {
    return res.status(400).json({ success: false, error: 'bookingId, workerId, rating required' });
  }

  // Prevent duplicate rating for same booking
  const existing = ratings.find(r => r.bookingId === bookingId);
  if (existing) {
    return res.json({ success: true, rating: existing, message: 'Already rated' });
  }

  const newRating = {
    _id: 'RT' + Date.now(),
    bookingId,
    workerId,
    rating: Math.min(5, Math.max(1, Number(rating))),
    comment: comment || '',
    createdAt: new Date().toISOString(),
  };
  ratings.push(newRating);

  // Update booking rating field
  const booking = bookings.find(b => b._id === bookingId);
  if (booking) {
    booking.rating = newRating.rating;
    booking.ratingComment = newRating.comment;
  }

  // Recalculate worker average rating
  const workerRatings = ratings.filter(r => r.workerId === workerId);
  if (workerRatings.length > 0) {
    const avg = workerRatings.reduce((s, r) => s + r.rating, 0) / workerRatings.length;
    const worker = adminWorkers.find(w => w._id === workerId);
    if (worker) worker.rating = Math.round(avg * 10) / 10;
  }

  saveData();
  console.log(`⭐ Rating: ${newRating.rating}/5 for worker ${workerId}`);
  res.json({ success: true, rating: newRating });
});

// Get all ratings for a worker
app.get('/api/ratings/worker/:id', (req, res) => {
  const workerRatings = ratings
    .filter(r => r.workerId === req.params.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, ratings: workerRatings, count: workerRatings.length });
});

// ══════════════════════════════════════════════════════════════
//  INVOICE ROUTE
// ══════════════════════════════════════════════════════════════

app.get('/api/bookings/:id/invoice', (req, res) => {
  const booking = bookings.find(b => b._id === req.params.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

  // Resolve customer name and phone safely
  const customerName = booking.userName || booking.userId?.name || 'Customer';
  const customerPhone = booking.userPhone || (booking.userId?.phone) || '';

  // Resolve worker name safely
  const workerName = booking.workerName || booking.workerId?.name || 'FixoN Worker';

  const basePrice   = booking.price || 0;
  const discount    = booking.discount || 0;
  const subtotal    = basePrice;
  const gst         = Math.round((basePrice - discount) * 0.18);
  const total       = (basePrice - discount) + gst;
  const workerShare = Math.round(total * 0.7);
  const platformFee = Math.round(total * 0.3);

  const invoice = {
    // Both invoice keys for maximum compatibility
    invoiceNo: 'INV-' + booking._id.slice(-8).toUpperCase(),
    invoiceNumber: 'FXN-' + booking._id.slice(-8).toUpperCase(),
    bookingId: booking._id,
    date: booking.completedAt || booking.createdAt || new Date().toISOString(),
    service: booking.service || 'Service',
    category: booking.category || booking.service || 'General',
    address: booking.location?.address || booking.address || 'Hyderabad',
    status: booking.status || 'completed',
    
    // Support object customer shape (Route A) and directly booking.userId (Route B)
    customer: {
      _id: booking.userId?._id || booking.userId || 'guest',
      name: customerName,
      phone: customerPhone,
    },
    
    // Support object worker shape (Route A) and directly booking.workerId (Route B)
    worker: {
      _id: booking.workerId?._id || booking.workerId || 'none',
      name: workerName,
      category: booking.category || 'General',
    },
    
    // Items list supporting both 'name' and 'description' properties
    items: [
      { 
        name: (booking.service || 'Service') + ' Service', 
        description: booking.service || 'Service', 
        amount: basePrice 
      }
    ],
    
    subtotal: subtotal,
    discount: discount,
    gst: gst,
    total: total,
    workerShare: workerShare,
    platformFee: platformFee,
    paymentStatus: 'Paid',
    paymentMode: 'Online',
    company: { 
      name: 'FixoN Services Pvt. Ltd.', 
      phone: '1800-FIXON-00', 
      email: 'support@fixon.com', 
      address: 'Hyderabad, Telangana' 
    }
  };

  res.json({ success: true, invoice });
});



app.get('/api/services', (req, res) => {
  res.json({ success: true, services: services.filter(s => s.active !== false) });
});

app.get('/api/admin/services', (req, res) => {
  res.json({ success: true, services });
});

app.post('/api/admin/services', (req, res) => {
  const s = { _id: 'SV' + Date.now(), ...req.body, active: true };
  services.push(s);
  saveData();
  res.json({ success: true, service: s });
});

app.put('/api/admin/services/:id', (req, res) => {
  const idx = services.findIndex(s => s._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  services[idx] = { ...services[idx], ...req.body };
  saveData();
  res.json({ success: true, service: services[idx] });
});

app.delete('/api/admin/services/:id', (req, res) => {
  services = services.filter(s => s._id !== req.params.id);
  saveData();
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
//  CHAT ROUTES
// ══════════════════════════════════════════════════════════════

// (Duplicate route removed for clarity - defined near top of file)

app.get('/api/chat/all', (req, res) => {
  res.json({ success: true, messages });
});

// Syllabus alias: GET /api/chat/messages
app.get('/api/chat/messages', (req, res) => {
  const { userId } = req.query;
  const filtered = userId
    ? messages.filter(m => m.senderId === userId || m.receiverId === userId || (m.senderType === 'bot' && m.receiverId === userId))
    : messages;
  res.json({ success: true, messages: filtered });
});

app.post('/api/chat/admin-reply', (req, res) => {
  const { receiverId, message, senderType } = req.body;
  const msgObj = {
    senderId: 'admin',
    receiverId,
    message,
    senderType: senderType || 'admin',
    createdAt: new Date().toISOString()
  };
  messages.push(msgObj);
  io.emit('receive_message', msgObj);
  console.log(`📤 Admin → ${receiverId}: ${message}`);
  res.json({ success: true, message: msgObj });
});

app.post('/api/chat/send', (req, res) => {
  const { senderId, message } = req.body;
  if (!users[senderId]) {
    users[senderId] = {
      _id: senderId,
      name: req.body.name || ('Customer ' + senderId.slice(-4)),
      email: req.body.email || (senderId + '@fixon.com')
    };
    io.emit('new_user', users[senderId]);
  }

  const msgObj = {
    senderId,
    receiverId: 'admin',
    message,
    senderType: 'customer',
    createdAt: new Date().toISOString()
  };
  messages.push(msgObj);
  io.emit('receive_message', msgObj);
  console.log(`📩 ${users[senderId].name}: ${message}`);

  // Bot auto-reply
  setTimeout(() => {
    const botReply = getBotReply(message);
    const botMsg = {
      senderId: 'bot',
      receiverId: senderId,
      message: botReply,
      senderType: 'bot',
      createdAt: new Date().toISOString()
    };
    messages.push(botMsg);
    io.emit('receive_message', botMsg);
  }, 800);

  res.json({ success: true, message: msgObj });
});

// ══════════════════════════════════════════════════════════════
//  SOCKET.IO
// ══════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Send current customer list to new admin connection
  socket.on('admin_join', () => {
    console.log('👑 Admin panel connected');
    // Send all existing live locations
    Object.values(users).filter(u => u.lat).forEach(u => {
      socket.emit('user_location', { userId: u._id, name: u.name, lat: u.lat, lng: u.lng, address: u.address });
    });
  });

  socket.on('customer_join', (data) => console.log('👤 Customer app connected:', data));
  socket.on('disconnect', () => console.log('❌ Disconnected:', socket.id));
});

// ══════════════════════════════════════════════════════════════
//  RATINGS ROUTES
// ══════════════════════════════════════════════════════════════

app.post('/api/ratings', (req, res) => {
  const { bookingId, workerId, userId, rating, comment } = req.body;
  if (!bookingId || !workerId || !rating) return res.status(400).json({ success: false, error: 'Missing fields' });

  const ratingObj = {
    _id: 'RT' + Date.now(),
    bookingId, workerId, userId,
    rating: parseFloat(rating),
    comment: comment || '',
    createdAt: new Date().toISOString()
  };

  // Store rating in booking
  const booking = bookings.find(b => b._id === bookingId);
  if (booking) { booking.rating = ratingObj; booking.rated = true; }

  // Update worker average rating
  const worker = adminWorkers.find(w => w._id === workerId);
  if (worker) {
    const allRatings = bookings.filter(b => b.workerId?._id === workerId && b.rating).map(b => b.rating.rating);
    allRatings.push(parseFloat(rating));
    worker.rating = (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1);
    worker.totalRatings = allRatings.length;
  }

  saveData();
  io.emit('new_rating', ratingObj);
  console.log(`⭐ Rating: ${rating}/5 for worker ${workerId}`);
  res.json({ success: true, rating: ratingObj });
});

app.get('/api/ratings/worker/:workerId', (req, res) => {
  const rated = bookings.filter(b => b.workerId?._id === req.params.workerId && b.rating);
  res.json({ success: true, ratings: rated.map(b => b.rating) });
});

// ══════════════════════════════════════════════════════════════
//  COUPONS ROUTES
// ══════════════════════════════════════════════════════════════

app.get(['/api/coupons', '/api/admin/coupons'], (req, res) => {
  res.json({ success: true, coupons });
});

app.post(['/api/coupons', '/api/admin/coupons'], (req, res) => {
  const c = { _id: 'CP' + Date.now(), ...req.body, used: 0, active: true, createdAt: new Date().toISOString() };
  coupons.push(c);
  saveData();
  res.json({ success: true, coupon: c });
});

app.put(['/api/coupons/:id', '/api/admin/coupons/:id'], (req, res) => {
  const idx = coupons.findIndex(c => c._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  coupons[idx] = { ...coupons[idx], ...req.body };
  saveData();
  res.json({ success: true, coupon: coupons[idx] });
});

app.delete(['/api/coupons/:id', '/api/admin/coupons/:id'], (req, res) => {
  coupons = coupons.filter(c => c._id !== req.params.id);
  saveData();
  res.json({ success: true });
});

app.patch(['/api/coupons/:id/toggle', '/api/admin/coupons/:id/toggle'], (req, res) => {
  const c = coupons.find(c => c._id === req.params.id);
  if (!c) return res.status(404).json({ success: false });
  c.active = !c.active;
  saveData();
  res.json({ success: true, coupon: c });
});

// Apply coupon (mobile app)
app.post('/api/coupons/apply', (req, res) => {
  const { code, orderAmount } = req.body;
  const coupon = coupons.find(c => c.code === code?.toUpperCase() && c.active);
  if (!coupon) return res.status(404).json({ success: false, error: 'Invalid or expired coupon' });
  if (new Date(coupon.expiry) < new Date()) return res.status(400).json({ success: false, error: 'Coupon expired' });
  if (coupon.minOrder && orderAmount < coupon.minOrder) return res.status(400).json({ success: false, error: `Minimum order ₹${coupon.minOrder} required` });

  const discount = coupon.type === 'percent'
    ? Math.round((orderAmount * coupon.discount) / 100)
    : coupon.discount;

  coupon.used = (coupon.used || 0) + 1;
  saveData();
  res.json({ success: true, discount, finalAmount: orderAmount - discount, coupon });
});

// ══════════════════════════════════════════════════════════════
//  REFERRAL ROUTES
// ══════════════════════════════════════════════════════════════

app.post('/api/referral/generate', (req, res) => {
  const { userId } = req.body;
  const user = registeredUsers.find(u => u._id === userId);
  if (!user) return res.status(404).json({ success: false });
  if (!user.referralCode) {
    user.referralCode = 'FIXON' + userId.slice(-5).toUpperCase();
    saveData();
  }
  res.json({ success: true, referralCode: user.referralCode, cashback: 50 });
});

app.post('/api/referral/apply', (req, res) => {
  const { referralCode, newUserId } = req.body;
  const referrer = registeredUsers.find(u => u.referralCode === referralCode);
  if (!referrer) return res.status(404).json({ success: false, error: 'Invalid referral code' });
  if (referrer._id === newUserId) return res.status(400).json({ success: false, error: 'Cannot refer yourself' });

  referrer.wallet = (referrer.wallet || 0) + 50;
  const newUser = registeredUsers.find(u => u._id === newUserId);
  if (newUser) newUser.wallet = (newUser.wallet || 0) + 50;

  saveData();
  io.emit('referral_bonus', { referrerId: referrer._id, newUserId, bonus: 50 });
  res.json({ success: true, message: 'Both users credited ₹50!' });
});

// (Invoice route is defined above at /api/bookings/:id/invoice)

// ══════════════════════════════════════════════════════════════
//  WORKER PAYOUT ROUTES
// ══════════════════════════════════════════════════════════════

app.get('/api/workers/:id/payouts', (req, res) => {
  const worker = adminWorkers.find(w => w._id === req.params.id);
  if (!worker) return res.status(404).json({ success: false });

  const workerBookings = bookings.filter(b => b.workerId?._id === req.params.id && b.status === 'completed');
  const totalEarnings = workerBookings.reduce((sum, b) => sum + (b.price || 0) * 0.7, 0); // 70% to worker
  const platformCut = workerBookings.reduce((sum, b) => sum + (b.price || 0) * 0.3, 0);

  res.json({
    success: true,
    worker: { name: worker.name, category: worker.category },
    totalJobs: workerBookings.length,
    totalEarnings: Math.round(totalEarnings),
    platformCut: Math.round(platformCut),
    averagePerJob: workerBookings.length ? Math.round(totalEarnings / workerBookings.length) : 0,
    bookings: workerBookings.map(b => ({
      _id: b._id, service: b.service, price: b.price,
      workerEarning: Math.round((b.price || 0) * 0.7),
      date: b.createdAt, status: b.status
    }))
  });
});

app.get('/api/admin/payouts', (req, res) => {
  const payoutSummary = adminWorkers.map(worker => {
    const workerBookings = bookings.filter(b => b.workerId?._id === worker._id && b.status === 'completed');
    const totalEarnings = workerBookings.reduce((sum, b) => sum + (b.price || 0) * 0.7, 0);
    return {
      workerId: worker._id,
      name: worker.name,
      category: worker.category,
      totalJobs: workerBookings.length,
      totalEarnings: Math.round(totalEarnings),
      rating: worker.rating || 0
    };
  });
  res.json({ success: true, payouts: payoutSummary });
});

// ══════════════════════════════════════════════════════════════
//  OTP LOGIN ROUTES
//  ─ Real SMS via Fast2SMS when FAST2SMS_KEY env var is set
//  ─ Falls back to console/response mode for local development
// ══════════════════════════════════════════════════════════════

const otpStore = {}; // phone → { otp, expires, sentAt }
const FAST2SMS_KEY = process.env.FAST2SMS_KEY || '';
const IS_PROD = !!FAST2SMS_KEY;

async function sendSmsOtp(phone, otp) {
  // Requires: npm install node-fetch (or use built-in fetch in Node 18+)
  const url = `https://www.fast2sms.com/dev/bulkV2`;
  const body = {
    route: 'otp',
    variables_values: otp,
    numbers: phone,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: FAST2SMS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.return) throw new Error(data.message || 'SMS failed');
  return true;
}

app.post('/api/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ success: false, error: 'Valid 10-digit phone number required' });
  }

  // Resend cooldown: 60 seconds
  const existing = otpStore[phone];
  if (existing && Date.now() - existing.sentAt < 60_000) {
    const wait = Math.ceil((60_000 - (Date.now() - existing.sentAt)) / 1000);
    return res.status(429).json({ success: false, error: `Please wait ${wait}s before requesting a new OTP` });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000, sentAt: Date.now() };

  if (IS_PROD) {
    // ── Real SMS ──────────────────────────────────────────────
    try {
      await sendSmsOtp(phone, otp);
      console.log(`📱 Real SMS OTP sent to ${phone}`);
      // ⚠️ Never return OTP in production
      res.json({ success: true, message: `OTP sent to +91 ${phone}` });
    } catch (err) {
      console.error('SMS Error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to send SMS. Check Fast2SMS key or balance.' });
    }
  } else {
    // ── Development mode: return OTP in response ──────────────
    console.log(`📱 [DEV] OTP for ${phone}: ${otp}  (Set FAST2SMS_KEY to enable real SMS)`);
    res.json({
      success: true,
      message: `[DEV MODE] OTP generated for ${phone}`,
      otp,           // ← Only in dev! Removed in production
      dev: true,
    });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp, name } = req.body;
  if (!phone || !otp) return res.status(400).json({ success: false, error: 'Phone and OTP required' });

  const record = otpStore[phone];
  if (!record) return res.status(400).json({ success: false, error: 'No OTP requested for this number. Please request first.' });
  if (Date.now() > record.expires) {
    delete otpStore[phone];
    return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
  }
  if (record.otp !== otp.toString()) {
    return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
  }

  delete otpStore[phone]; // Consume OTP — one-time use
  let user = registeredUsers.find(u => u.phone === phone);
  if (!user) {
    const userId = 'U' + Date.now();
    user = {
      _id: userId,
      name: name || ('User_' + phone.slice(-4)),
      phone,
      email: '',
      isBlocked: false,
      totalBookings: 0,
      wallet: 0,
      referralCode: 'FIXON' + phone.slice(-5).toUpperCase(),
      createdAt: new Date().toISOString(),
      location: {},
    };
    registeredUsers.push(user);
    saveData();
    console.log(`🆕 New user via OTP: ${user.name} (${phone})`);
  } else {
    console.log(`✅ OTP login: ${user.name} (${phone})`);
  }
  res.json({ success: true, token: 'local_' + user._id, user });
});

// ══════════════════════════════════════════════════════════════
//  CITIES & WORKER FILTERING
// ══════════════════════════════════════════════════════════════

const CITIES = ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam', 'Nalgonda', 'Suryapet'];

app.get('/api/cities', (req, res) => {
  res.json({ success: true, cities: CITIES });
});

app.get('/api/workers/city/:city', (req, res) => {
  const city = req.params.city;
  const cityWorkers = adminWorkers.filter(w =>
    w.active !== false && w.isActive !== false &&
    (!w.city || w.city.toLowerCase() === city.toLowerCase())
  );
  res.json({ success: true, workers: cityWorkers });
});

// ══════════════════════════════════════════════════════════════
//  FCM PUSH NOTIFICATION TOKEN STORAGE
// ══════════════════════════════════════════════════════════════

const fcmTokens = {}; // userId → fcmToken

app.post('/api/notifications/register', (req, res) => {
  const { userId, fcmToken } = req.body;
  if (userId && fcmToken) {
    fcmTokens[userId] = fcmToken;
    console.log(`🔔 FCM token registered for user ${userId}`);
  }
  res.json({ success: true });
});

// GET /api/notifications
app.get('/api/notifications', (req, res) => {
  console.log(`🔍 GET /api/notifications requested. Count: ${notificationsList.length}`);
  res.json({ success: true, notifications: notificationsList });
});

// POST /api/notifications/send
app.post('/api/notifications/send', (req, res) => {
  const { userId, title, body, type } = req.body;
  const newNotif = {
    _id: 'NT' + Date.now(),
    userId: userId || 'all',
    title: title || 'Alert',
    body: body || '',
    type: type || 'all',
    icon: type === 'promo' ? '🎁' : type === 'booking' ? '📦' : type === 'worker' ? '👷' : '📢',
    createdAt: new Date().toISOString(),
  };

  notificationsList.push(newNotif);
  saveData();

  // 1. Emit via Socket.IO for real-time mobile sync
  io.emit('new_notification', newNotif);

  // 2. Log in server console
  console.log(`🔔 Notification broadcast [${newNotif.type}]: "${title}"`);

  res.json({ success: true, notification: newNotif });
});


// ══════════════════════════════════════════════════════════════
//  PREMIUM ADDITIONS: PHOTOS, VERIFICATION, CHAT & AI
// ══════════════════════════════════════════════════════════════

// 1. Update Booking Before/After Photos
app.post('/api/bookings/:id/photos', (req, res) => {
  const { beforePhoto, afterPhoto } = req.body;
  const b = bookings.find(x => x._id === req.params.id);
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });

  if (beforePhoto !== undefined) {
    b.beforePhoto = beforePhoto;
    b.beforePhotoUploadedAt = new Date().toISOString();
  }
  if (afterPhoto !== undefined) {
    b.afterPhoto = afterPhoto;
    b.afterPhotoUploadedAt = new Date().toISOString();
  }

  saveData();
  io.emit('booking_update', { bookingId: b._id, status: b.status, booking: b });
  console.log(`📸 Photos updated for booking ${b._id}: before=${!!b.beforePhoto}, after=${!!b.afterPhoto}`);
  res.json({ success: true, booking: b });
});

// 2. Submit Worker Document Verification
app.post('/api/workers/:id/verify-document', (req, res) => {
  const { documentType, documentNumber, documentFrontUrl, documentBackUrl } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.verification = {
    documentType,
    documentNumber,
    documentFrontUrl: documentFrontUrl || 'https://via.placeholder.com/300?text=Aadhaar+Front',
    documentBackUrl: documentBackUrl || 'https://via.placeholder.com/300?text=Aadhaar+Back',
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  saveData();
  io.emit('worker_updated', w);
  console.log(`Worker document submitted for verification: ${w.name}`);
  res.json({ success: true, worker: w });
});

// 3. Admin updates worker document verification status
app.post('/api/admin/workers/:id/verify-status', (req, res) => {
  const { status, rejectionReason } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  if (!w.verification) {
    return res.status(400).json({ success: false, error: 'No verification document uploaded' });
  }

  w.verification.status = status;
  w.verification.verifiedAt = new Date().toISOString();
  if (rejectionReason) w.verification.rejectionReason = rejectionReason;

  if (status === 'approved') {
    w.active = true;
    w.isActive = true;
    w.isAvailable = true;
  } else {
    w.active = false;
    w.isActive = false;
    w.isAvailable = false;
  }

  saveData();
  io.emit('worker_updated', w);
  console.log(`Worker ${w.name} verification status updated: ${status}`);
  res.json({ success: true, worker: w });
});

// 4. Send Customer <-> Worker Private Messages
app.post('/api/chat/send-private', (req, res) => {
  const { senderId, receiverId, message, senderType, senderName } = req.body;
  if (!senderId || !receiverId || !message) {
    return res.status(400).json({ success: false, error: 'Missing parameters' });
  }

  const msgObj = {
    senderId,
    receiverId,
    message,
    senderType: senderType || 'customer',
    senderName: senderName || 'User',
    createdAt: new Date().toISOString()
  };

  messages.push(msgObj);
  io.emit('receive_message', msgObj);
  console.log(`💬 Private Msg: ${senderName || senderId} → ${receiverId}: ${message}`);

  if (receiverId === 'bot') {
    setTimeout(() => {
      const reply = getBotReply(message);
      const botMsg = {
        senderId: 'bot',
        receiverId: senderId,
        message: reply,
        senderType: 'bot',
        createdAt: new Date().toISOString()
      };
      messages.push(botMsg);
      io.emit('receive_message', botMsg);
    }, 800);
  }

  res.json({ success: true, message: msgObj });
});

// 5. Get Private Messages
app.get('/api/chat/private-messages', (req, res) => {
  const { userA, userB } = req.query;
  if (!userA || !userB) return res.status(400).json({ success: false, error: 'Missing userA/userB query params' });

  const filtered = messages.filter(m =>
    (m.senderId === userA && m.receiverId === userB) ||
    (m.senderId === userB && m.receiverId === userA) ||
    (m.senderType === 'bot' && m.senderId === 'bot' && m.receiverId === userA && userB === 'bot')
  );

  res.json({ success: true, messages: filtered });
});

// 6. AI Vision Analyzer using Gemini Vision or Intelligent Mock Fallback
app.post('/api/ai/detect-issue', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ success: false, error: 'No image provided' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      let imagePart;
      if (image.startsWith('data:image')) {
        const mime = image.split(';')[0].split(':')[1];
        const base64Data = image.split(',')[1];
        imagePart = { inlineData: { data: base64Data, mimeType: mime } };
      } else {
        const base64Data = image.includes(',') ? image.split(',')[1] : image;
        imagePart = { inlineData: { data: base64Data, mimeType: 'image/jpeg' } };
      }

      const prompt = `
        You are FixoN AI, an expert home appliance and repair diagnosis assistant.
        Analyze the uploaded photo showing a home repair issue (e.g. leaking sink, broken fan, spark in socket, AC water dripping, wall paint peel).
        Identify the problem and provide a JSON response in the following exact format:
        {
          "detectedIssue": "short name of issue",
          "confidence": 0.95,
          "category": "Plumbing" or "Electrical" or "Cleaning" or "AC Repair" or "Carpentry" or "Painting",
          "description": "Short friendly analysis of what is wrong and what is recommended to solve it.",
          "estimatedCost": 499
        }
        Ensure the category is exactly one of our supported services: Plumbing, Electrical, Cleaning, AC Repair, Carpentry, Painting.
        Output ONLY the valid JSON, no markdown block syntax.
      `;

      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(cleanText);

      return res.json({ success: true, analysis });
    } catch (err) {
      console.error('🔥 Real Gemini API Error:', err);
    }
  }

  // Fallback simulator mode (highly realistic responses for testing)
  console.log('🤖 [AI] Using Mock Intelligent Diagnosis Mode');
  await new Promise(resolve => setTimeout(resolve, 1500));

  const mockDiagnoses = [
    {
      detectedIssue: 'Water Pipe Joint Leakage',
      confidence: 0.94,
      category: 'Plumbing',
      description: 'Slow water drip detected near the connector valve joint. This can cause mineral deposits and floor damage. Replacing the sealing washer is recommended.',
      estimatedCost: 499
    },
    {
      detectedIssue: 'Airflow Restriction & Fan Dusting',
      confidence: 0.88,
      category: 'AC Repair',
      description: 'The internal filter displays heavy dust blockage restricting airflow. This causes noise and increases power consumption. Full cleaning recommended.',
      estimatedCost: 799
    },
    {
      detectedIssue: 'Damaged Electrical Socket Switch',
      confidence: 0.96,
      category: 'Electrical',
      description: 'Electrical socket suggests terminal wear or high load stress. We recommend safely isolating power and replacing the switch socket board.',
      estimatedCost: 599
    }
  ];

  const randomMatch = mockDiagnoses[Math.floor(Math.random() * mockDiagnoses.length)];
  res.json({ success: true, analysis: randomMatch });
});



// ══════════════════════════════════════════════════════════════
//  WORKER APP ROUTES
// ══════════════════════════════════════════════════════════════

// Helper: generate worker ID & password
function generateWorkerCredentials(category, existingCount) {
  const prefixMap = {
    'Plumbing': 'PLM', 'Electrical': 'ELC', 'Cleaning': 'CLN',
    'AC Repair': 'ACR', 'Carpentry': 'CRP', 'Painting': 'PNT',
    'Pest Control': 'PST', 'CCTV Setup': 'CCT', 'RO Technician': 'ROT',
  };
  const prefix = prefixMap[category] || 'WRK';
  const num = String(1001 + existingCount).padStart(4, '0');
  const workerId = `FIXON_${prefix}_${num}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = 'FXN';
  for (let i = 0; i < 4; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return { workerId, password: pass };
}

// W1. Worker Login (Worker ID + Password)
app.post('/api/worker/login', (req, res) => {
  const { workerId, password } = req.body;
  if (!workerId || !password) return res.status(400).json({ success: false, error: 'Worker ID and password required' });

  const w = adminWorkers.find(x => x.workerId === workerId || x._id === workerId);
  if (!w) return res.status(401).json({ success: false, error: 'Worker ID not found' });
  if (!w.active) return res.status(403).json({ success: false, error: 'Worker account not approved yet' });
  if (w.workerPassword !== password) return res.status(401).json({ success: false, error: 'Wrong password' });

  // Mark as online
  w.isOnline = true;
  w.lastSeen = new Date().toISOString();
  saveData();
  io.emit('worker_status', { workerId: w._id, isOnline: true });

  console.log(`👷 Worker login: ${w.name} (${w.workerId})`);
  res.json({ success: true, token: 'worker_' + w._id, worker: w });
});

// W2. Worker Dashboard (earnings, stats)
app.get('/api/worker/:id/dashboard', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  const myBookings = bookings.filter(b => {
    const wId = b.workerId?._id || b.workerId;
    return wId === w._id;
  });

  const completed = myBookings.filter(b => b.status === 'completed');
  const ongoing = myBookings.filter(b => b.status === 'ongoing' || b.status === 'accepted' || b.status === 'on_the_way');
  const totalEarnings = completed.reduce((sum, b) => sum + (b.price || 0), 0);
  const workerEarnings = Math.round(totalEarnings * 0.8); // 80% to worker, 20% platform
  const todayBookings = completed.filter(b => {
    const d = new Date(b.completedAt || b.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayEarnings = todayBookings.reduce((sum, b) => sum + Math.round((b.price || 0) * 0.8), 0);

  res.json({
    success: true,
    stats: {
      totalBookings: myBookings.length,
      completedBookings: completed.length,
      ongoingBookings: ongoing.length,
      totalEarnings: workerEarnings,
      todayEarnings,
      rating: w.rating || 0,
      isOnline: w.isOnline || false,
    },
    recentBookings: myBookings.slice(-5).reverse(),
  });
});

// W3. Get Worker's Bookings
app.get('/api/worker/:id/bookings', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  const myBookings = bookings.filter(b => {
    const wId = b.workerId?._id || b.workerId;
    return wId === w._id;
  });
  res.json({ success: true, bookings: myBookings });
});

// W4. Get Pending Bookings (for worker's category — new bookings to accept)
app.get('/api/worker/:id/pending-bookings', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  const pending = bookings.filter(b => {
    const cat = b.category || b.service || '';
    const matches = cat.toLowerCase().includes(w.category.toLowerCase()) ||
                    w.category.toLowerCase().includes(cat.toLowerCase()) ||
                    (w.skills || []).some(s => cat.toLowerCase().includes(s.toLowerCase()));
    
    // Check if worker has already rejected this booking
    const hasRejected = b.rejectedBy && (b.rejectedBy.includes(w._id) || b.rejectedBy.includes(w.workerId));
    
    return b.status === 'pending' && !b.workerId && matches && !hasRejected;
  });
  res.json({ success: true, bookings: pending });
});

// W5. Accept Booking
app.post('/api/worker/:wId/accept-booking/:bookingId', (req, res) => {
  console.log(`📥 [API] Worker Accept Booking requested: wId=${req.params.wId}, bookingId=${req.params.bookingId}`);
  const w = adminWorkers.find(x => x._id === req.params.wId || x.workerId === req.params.wId);
  if (!w) {
    console.log(`❌ Worker not found for ID: ${req.params.wId}`);
    return res.status(404).json({ success: false, error: 'Worker not found' });
  }

  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!b) {
    console.log(`❌ Booking not found for ID: ${req.params.bookingId}`);
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  if (b.status !== 'pending') {
    console.log(`❌ Booking ${b._id} cannot be accepted. Current status: ${b.status}`);
    return res.status(400).json({ success: false, error: 'Booking already taken' });
  }

  b.workerId = { _id: w._id, name: w.name, phone: w.phone, rating: w.rating };
  b.status = 'accepted';
  b.acceptedAt = new Date().toISOString();
  w.isAvailable = false;

  saveData();
  io.emit('booking_update', { bookingId: b._id, status: 'accepted', booking: b });
  io.emit('worker_updated', w);

  // Notify customer
  const notif = {
    _id: 'N' + Date.now(),
    userId: b.userId?._id || b.userId,
    title: '✅ Worker Assigned!',
    message: `${w.name} has accepted your booking and is on the way!`,
    type: 'booking',
    bookingId: b._id,
    createdAt: new Date().toISOString(),
    read: false,
  };
  notificationsList.push(notif);
  io.emit('new_notification', notif);

  console.log(`👷 ${w.name} accepted booking ${b._id}`);
  res.json({ success: true, booking: b });
});

// W6. Reject Booking
app.post('/api/worker/:wId/reject-booking/:bookingId', (req, res) => {
  console.log(`📥 [API] Worker Reject Booking requested: wId=${req.params.wId}, bookingId=${req.params.bookingId}`);
  const w = adminWorkers.find(x => x._id === req.params.wId || x.workerId === req.params.wId);
  if (!w) {
    console.log(`❌ Worker not found for ID: ${req.params.wId}`);
    return res.status(404).json({ success: false, error: 'Worker not found' });
  }

  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!b) {
    console.log(`❌ Booking not found for ID: ${req.params.bookingId}`);
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  // Just skip — booking stays pending for another worker
  b.rejectedBy = b.rejectedBy || [];
  if (!b.rejectedBy.includes(w._id)) {
    b.rejectedBy.push(w._id);
  }

  saveData();
  console.log(`❌ ${w.name} rejected booking ${b._id}`);
  res.json({ success: true, message: 'Booking skipped' });
});

// W7. Mark Booking as On The Way
app.post('/api/worker/:wId/booking/:bookingId/on-the-way', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.wId || x.workerId === req.params.wId);
  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!w || !b) return res.status(404).json({ success: false, error: 'Not found' });

  b.status = 'on_the_way';
  b.onTheWayAt = new Date().toISOString();
  saveData();
  io.emit('booking_update', { bookingId: b._id, status: 'on_the_way', booking: b });

  const notif = {
    _id: 'N' + Date.now(),
    userId: b.userId?._id || b.userId,
    title: '🏍️ Worker On The Way!',
    message: `${w.name} is heading to your location now.`,
    type: 'booking',
    bookingId: b._id,
    createdAt: new Date().toISOString(),
    read: false,
  };
  notificationsList.push(notif);
  io.emit('new_notification', notif);

  res.json({ success: true, booking: b });
});

// W8. Start Work (ongoing)
app.post('/api/worker/:wId/booking/:bookingId/start', (req, res) => {
  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });
  b.status = 'ongoing';
  b.startedAt = new Date().toISOString();
  saveData();
  io.emit('booking_update', { bookingId: b._id, status: 'ongoing', booking: b });
  res.json({ success: true, booking: b });
});

// W9. Complete Booking
app.post('/api/worker/:wId/booking/:bookingId/complete', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.wId || x.workerId === req.params.wId);
  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!w || !b) return res.status(404).json({ success: false, error: 'Not found' });

  b.status = 'completed';
  b.completedAt = new Date().toISOString();
  w.isAvailable = true;

  // Update worker stats
  w.totalEarnings = (w.totalEarnings || 0) + Math.round((b.price || 0) * 0.8);
  w.completedJobs = (w.completedJobs || 0) + 1;

  saveData();
  io.emit('booking_update', { bookingId: b._id, status: 'completed', booking: b });
  io.emit('worker_updated', w);

  const notif = {
    _id: 'N' + Date.now(),
    userId: b.userId?._id || b.userId,
    title: '🎉 Service Completed!',
    message: `${w.name} has completed your service. Please rate your experience!`,
    type: 'booking',
    bookingId: b._id,
    createdAt: new Date().toISOString(),
    read: false,
  };
  notificationsList.push(notif);
  io.emit('new_notification', notif);

  console.log(`✅ ${w.name} completed booking ${b._id}`);
  res.json({ success: true, booking: b });
});

// W10. Toggle Online / Offline
app.put('/api/worker/:id/status', (req, res) => {
  const { isOnline } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });
  w.isOnline = isOnline;
  w.isAvailable = isOnline;
  w.lastSeen = new Date().toISOString();
  saveData();
  io.emit('worker_status', { workerId: w._id, isOnline });
  res.json({ success: true, worker: w });
});

// W11. Get Worker Profile
app.get('/api/worker/:id/profile', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });
  res.json({ success: true, worker: w });
});

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    users: registeredUsers.length,
    bookings: bookings.length,
    workers: adminWorkers.length,
    coupons: coupons.length,
    messages: messages.length,
    uptime: process.uptime(),
  });
});

// (Server listen moved to top for startup sync)
