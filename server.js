const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] }
});

// ── Persistent file storage ──────────────────────────────────
const DATA_FILE = path.join(__dirname, 'fixon_data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch {}
  return { users: {}, bookings: [], messages: [], registeredUsers: [] };
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users, bookings, messages, registeredUsers }, null, 2));
  } catch {}
}

const saved = loadData();

// ── In-memory stores ─────────────────────────────────────────
const users = saved.users || {};           // userId → live location tracking
const workers = {};                        // workerId → { _id, name, lat, lng }
let messages = saved.messages || [];
let bookings = saved.bookings || [];
let registeredUsers = saved.registeredUsers || [];  // real sign-ups

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

// Admin: get all registered users
app.get('/api/admin/users', (req, res) => {
  const allUsers = registeredUsers.map(u => ({
    ...u,
    location: users[u._id] ? { lat: users[u._id].lat, lng: users[u._id].lng } : u.location,
    totalBookings: bookings.filter(b => b.userId?._id === u._id).length,
  }));
  res.json({ success: true, users: allUsers });
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

// Mobile app creates a booking
app.post('/api/bookings', (req, res) => {
  const { userId, service, price, category, scheduledTime, lat, lng, address, name } = req.body;
  
  // 🔍 Look up real name from registeredUsers array
  const realUser = registeredUsers.find(u => u._id === userId);
  const finalName = name || realUser?.name || users[userId]?.name || 'Customer';

  // Register user in live map if not seen
  if (userId && !users[userId]) {
    users[userId] = { _id: userId, name: finalName, email: realUser?.email || '' };
  } else if (users[userId] && users[userId].name === 'Customer' && finalName !== 'Customer') {
    // Update live map name if it was previously just "Customer"
    users[userId].name = finalName;
  }

  const booking = {
    _id: 'BK' + Date.now(),
    userId: { _id: userId, name: finalName },
    service,
    price: price || 0,
    category: category || service,
    scheduledTime: scheduledTime || new Date().toISOString(),
    status: 'pending',
    location: { lat, lng, address: address || '' },
    workerId: null,
    createdAt: new Date().toISOString(),
  };

  bookings.push(booking);
  saveData();  // ✅ Persist immediately so bookings survive server restart

  // Notify admin panel live
  io.emit('new_booking', booking);
  console.log(`📦 New booking: ${booking.service} by ${booking.userId.name}`);

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

  io.emit('booking_update', { bookingId: b._id, status, booking: b });
  console.log(`🔄 Booking ${b._id} → ${status}`);
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

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    users: registeredUsers.length,
    bookings: bookings.length,
    messages: messages.length,
    uptime: process.uptime(),
  });
});

// ── Start ───────────────────────────────────────────────────
const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 FixoN Server running at http://localhost:${PORT}`);
  console.log(`   Admin panel : http://localhost:3000`);
  console.log(`   Socket.IO ready for real-time tracking ⚡\n`);
});
