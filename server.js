const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');

// ── MongoDB Atlas Connection ─────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB schema — stores ALL app data as one document
const AppDataSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  registeredUsers: { type: Array, default: [] },
  bookings: { type: Array, default: [] },
  messages: { type: Array, default: [] },
  notificationsList: { type: Array, default: [] },
  adminWorkers: { type: Array, default: [] },
  services: { type: Array, default: [] },
  coupons: { type: Array, default: [] },
}, { minimize: false });
const AppData = mongoose.models.AppData || mongoose.model('AppData', AppDataSchema);

// Schema for booking photos to prevent memory limits
const BookingPhotoSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  beforePhoto: String,
  afterPhoto: String,
  beforePhotoUploadedAt: String,
  afterPhotoUploadedAt: String,
}, { minimize: false });
const BookingPhoto = mongoose.models.BookingPhoto || mongoose.model('BookingPhoto', BookingPhotoSchema);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] }
});

// ── Persistent file storage (local fallback) ─────────────────
const DATA_FILE = path.join(__dirname, 'fixon_data.json');
const PHOTOS_FILE = path.join(__dirname, 'fixon_photos.json');

// ── In-memory stores (declared HERE so loadData() can write to them) ──
const users = {};           // userId → live location tracking
const workers = {};         // workerId → { _id, name, lat, lng } (live location)
const bookingPhotos = {};   // bookingId → { beforePhoto, afterPhoto, etc. }
let messages = [];
let bookings = [];
let registeredUsers = [];   // real sign-ups
let notificationsList = []; // admin sent notifications
let adminWorkers = [
  { _id: 'W_DEFAULT_1', name: 'VARUN',            phone: '9000853346', email: 'ADITHYAVARUN@GMAIL.COM',  category: 'Plumbing',   skills: ['Plumbing','Pipe Repair','Bathroom','Leak Fix'],         rating: 5,   active: true, isAvailable: false, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_PLM_1001', workerPassword: 'FXN1001', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_2', name: 'ADITHYA',          phone: '8179712126', email: 'varunpittala@gmail.com',  category: 'Electrical', skills: ['Electrical','Wiring','Fan Installation','Switch Repair'],  rating: 4.5, active: true, isAvailable: true,  isActive: true, isOnline: false, experience: '7 years',  workerId: 'FIXON_ELC_1001', workerPassword: 'FXN1002', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_3', name: 'Prasad Cleaning',  phone: '9876543212', email: 'prasad@fixon.com',        category: 'Cleaning',   skills: ['Cleaning','Deep Cleaning','Pest Control','Home Services'], rating: 4.3, active: true, isAvailable: true,  isActive: true, isOnline: false, experience: '3 years',  workerId: 'FIXON_CLN_1001', workerPassword: 'FXN1003', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_4', name: 'Vijay Tech',       phone: '9876543213', email: 'vijay@fixon.com',         category: 'AC Repair',  skills: ['AC Repair','AC Service','CCTV Installation','Appliances'],  rating: 5,   active: true, isAvailable: true,  isActive: true, isOnline: false, experience: '8 years',  workerId: 'FIXON_ACR_1001', workerPassword: 'FXN1004', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_5', name: 'Mahesh Carpenter', phone: '9876543214', email: 'mahesh@fixon.com',        category: 'Carpentry',  skills: ['Carpentry','Painting','Furniture','Wood Work'],            rating: 4,   active: true, isAvailable: true,  isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_CRP_1001', workerPassword: 'FXN1005', createdAt: new Date().toISOString() },
  { _id: 'W1781852119714', name: 'Bunny',          phone: '9550400036', email: 'pittalasuvarna@gmail.com', category: 'Electrical', skills: ['Electrical'],                                           rating: 5,   active: true, isAvailable: true,  isActive: true, isOnline: false, experience: '2 years',  workerId: 'FIXON_ELC_1002', workerPassword: 'FXNG333', createdAt: new Date().toISOString() },
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

const DEFAULT_CREDS = {
  'W_DEFAULT_1': { workerId:'FIXON_PLM_1001', workerPassword:'FXN1001' },
  'W_DEFAULT_2': { workerId:'FIXON_ELC_1001', workerPassword:'FXN1002' },
  'W_DEFAULT_3': { workerId:'FIXON_CLN_1001', workerPassword:'FXN1003' },
  'W_DEFAULT_4': { workerId:'FIXON_ACR_1001', workerPassword:'FXN1004' },
  'W_DEFAULT_5': { workerId:'FIXON_CRP_1001', workerPassword:'FXN1005' },
};

function applyDefaultCreds(workers) {
  return workers.map(w => {
    const cred = DEFAULT_CREDS[w._id];
    if (cred && !w.workerId) return { ...w, ...cred, isOnline: w.isOnline || false };
    return w;
  });
}

async function loadData() {
  // 1. Try MongoDB first (Render cloud)
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc) {
        if (doc.registeredUsers && doc.registeredUsers.length > 0) registeredUsers = doc.registeredUsers;
        if (doc.bookings) bookings = doc.bookings;
        if (doc.messages) messages = doc.messages;
        if (doc.notificationsList) notificationsList = doc.notificationsList;
        if (doc.adminWorkers && doc.adminWorkers.length > 0) adminWorkers = doc.adminWorkers;
        if (doc.services && doc.services.length > 0) services = doc.services;
        if (doc.coupons && doc.coupons.length > 0) coupons = doc.coupons;
        console.log('✅ Data loaded from MongoDB Atlas! Users:', registeredUsers.length);
        adminWorkers = applyDefaultCreds(adminWorkers);
        console.log('✅ Workers loaded:', adminWorkers.length);
        return;
      }
    } catch (err) {
      console.error('⚠️ MongoDB load failed, falling back to file:', err.message);
    }
  }

  // 2. Fallback: local file (for local dev / MongoDB not connected yet)
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
        if (parsed.adminWorkers && parsed.adminWorkers.length > 0) adminWorkers = parsed.adminWorkers;
        if (parsed.services && parsed.services.length > 0) services = parsed.services;
        if (parsed.coupons && parsed.coupons.length > 0) coupons = parsed.coupons;
      }
    }
  } catch (error) {
    console.error('🔥 Local Data Load Error:', error);
  }

  adminWorkers = applyDefaultCreds(adminWorkers);
  console.log('✅ Workers loaded:', adminWorkers.length, '| Credentialed:', adminWorkers.filter(w=>w.workerId).length);
}

// Generate unique Worker ID + password from category
function generateWorkerCredentials(category, existingCount) {
  const categoryMap = {
    'Plumbing': 'PLM', 'Electrical': 'ELC', 'Cleaning': 'CLN',
    'AC Repair': 'ACR', 'Carpentry': 'CRP', 'Painting': 'PNT',
    'Pest Control': 'PCT', 'CCTV Setup': 'CCT', 'Appliance Repair': 'APL',
  };
  const code = categoryMap[category] || 'WRK';
  const num = String(1001 + existingCount).padStart(4, '0');
  const workerId = `FIXON_${code}_${num}`;
  const password = 'FXN' + (1000 + Math.floor(Math.random() * 9000));
  return { workerId, password };
}

async function loadPhotos() {
  // 1. MongoDB Load
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const photos = await BookingPhoto.find({}).lean();
      photos.forEach(p => {
        bookingPhotos[p.bookingId] = {
          bookingId: p.bookingId,
          beforePhoto: p.beforePhoto || null,
          afterPhoto: p.afterPhoto || null,
          beforePhotoUploadedAt: p.beforePhotoUploadedAt || null,
          afterPhotoUploadedAt: p.afterPhotoUploadedAt || null
        };
      });
      console.log('✅ Photos loaded from MongoDB Atlas! Count:', Object.keys(bookingPhotos).length);

      // Migrated local photos if database is empty
      if (photos.length === 0 && fs.existsSync(PHOTOS_FILE)) {
        console.log('📤 Migrating local photos to MongoDB...');
        const localPhotos = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf-8') || '{}');
        for (const [bookingId, photoObj] of Object.entries(localPhotos)) {
          await BookingPhoto.findOneAndUpdate(
            { bookingId },
            { bookingId, ...photoObj },
            { upsert: true }
          );
        }
        console.log('✅ Migration complete!');
      }
      return;
    } catch (err) {
      console.error('⚠️ MongoDB photos load failed, using file fallback:', err.message);
    }
  }

  // 2. Local File Fallback
  try {
    if (fs.existsSync(PHOTOS_FILE)) {
      const text = fs.readFileSync(PHOTOS_FILE, 'utf-8');
      if (text && text.trim() !== '') {
        const parsed = JSON.parse(text);
        Object.assign(bookingPhotos, parsed);
      }
    }
    console.log('✅ Photos loaded from local file! Count:', Object.keys(bookingPhotos).length);
  } catch (error) {
    console.error('🔥 Local Photos Load Error:', error);
  }
}

async function savePhotos(bookingId) {
  const photoObj = bookingPhotos[bookingId];
  if (!photoObj) return;

  // 1. Save to MongoDB Atlas (primary)
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      await BookingPhoto.findOneAndUpdate(
        { bookingId },
        { bookingId, ...photoObj },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('⚠️ MongoDB photo save failed:', err.message);
    }
  }

  // 2. Fallback: local file
  try {
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(bookingPhotos, null, 2), 'utf-8');
  } catch (error) {
    console.error('🔥 Local Photo Save Error:', error);
  }
}

async function saveData() {
  // Strip photos from bookings and notificationsList copies before saving to prevent memory bloat
  const cleanBookings = bookings.map(b => {
    const copy = { ...b };
    delete copy.beforePhoto;
    delete copy.afterPhoto;
    delete copy.beforePhotoUploadedAt;
    delete copy.afterPhotoUploadedAt;
    return copy;
  });

  const cleanNotifs = notificationsList.map(n => {
    if (n.booking) {
      const copy = { ...n };
      const bCopy = { ...copy.booking };
      delete bCopy.beforePhoto;
      delete bCopy.afterPhoto;
      delete bCopy.beforePhotoUploadedAt;
      delete bCopy.afterPhotoUploadedAt;
      copy.booking = bCopy;
      return copy;
    }
    return n;
  });

  const dataObj = { registeredUsers, bookings: cleanBookings, messages, notificationsList: cleanNotifs, adminWorkers, services, coupons };

  // 1. Save to MongoDB Atlas (primary)
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      await AppData.findOneAndUpdate(
        { key: 'main' },
        { key: 'main', ...dataObj },
        { upsert: true, new: true }
      );
      return; // success — no need for file fallback
    } catch (err) {
      console.error('⚠️ MongoDB save failed, using file fallback:', err.message);
    }
  }

  // 2. Fallback: local file
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf-8');
  } catch (error) {
    console.error('🔥 Local Data Save Error:', error);
  }
}

// ── Start server: connect MongoDB first, THEN load data ────────
async function startServer() {
  // 1. Connect to MongoDB Atlas first (await it!)
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      console.log('✅ MongoDB Atlas connected!');
    } catch (err) {
      console.error('❌ MongoDB connect error:', err.message);
      console.log('⚠️  Falling back to local file storage...');
    }
  }

  // 2. Load data AFTER connection is established
  await loadData();
  await loadPhotos();
  console.log('🔥 Initial data loaded!');

  // 3. Start HTTP server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 FixoN Server running at port ${PORT}`);
    console.log(`   Socket.IO ready for real-time tracking ⚡\n`);
  });

  // 4. Auto-save every 30 seconds
  setInterval(saveData, 30000);
}

startServer().catch(err => {
  console.error('❌ Fatal startup error:', err);
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server started (Emergency Mode) on port ${PORT}`));
});

// ── Socket.IO Connection Handler ──────────────────────────────
// Maps socket.id → userId so we can detect when a customer goes offline
const socketUserMap = {};

io.on('connection', (socket) => {
  // Customer mobile app joins
  socket.on('customer_join', (data) => {
    const userId = data?.userId;
    const userName = data?.name || 'Customer';
    if (userId) {
      socket.userId = userId;
      socketUserMap[socket.id] = userId;
      // Update lastSeen so they appear online
      if (!users[userId]) {
        const realUser = registeredUsers.find(u => u._id === userId);
        users[userId] = { _id: userId, name: userName, email: realUser?.email || '' };
      }
      users[userId].lastSeen = new Date().toISOString();
      console.log(`👤 Customer joined socket: ${userName} (${userId})`);
    }
  });

  // Admin panel joins (for future use)
  socket.on('admin_join', () => {
    socket.isAdmin = true;
  });

  // ✅ When customer disconnects → immediately remove from live map
  socket.on('disconnect', () => {
    const userId = socket.userId || socketUserMap[socket.id];
    if (userId) {
      delete socketUserMap[socket.id];
      delete socket.userId;
      // Only remove if no other socket for this user is connected
      const stillConnected = Object.values(socketUserMap).includes(userId);
      if (!stillConnected) {
        delete users[userId];
        io.emit('user_offline', { userId });
        console.log(`📴 Customer offline: ${userId}`);
      }
    }
  });
});

// ── Periodic MongoDB Reload every 60s (so admin panel gets Render cloud bookings) ──
setInterval(async () => {
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc) {
        if (doc.bookings && doc.bookings.length >= bookings.length) bookings = doc.bookings;
        if (doc.registeredUsers && doc.registeredUsers.length >= registeredUsers.length) registeredUsers = doc.registeredUsers;
        if (doc.adminWorkers && doc.adminWorkers.length > 0) adminWorkers = applyDefaultCreds(doc.adminWorkers);
      }
    } catch (e) {
      // Silent fail — in-memory data stays valid
    }
  }
}, 60000);

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
  { keywords: ['leak', 'water', 'pipe', 'tap', 'clog', 'sink', 'drain'],
    reply: '💧 Plumbing issue detected! If you have an active water leak, please shut off your main water valve first. You can book an emergency Plumber directly from the home screen.' },
  { keywords: ['shock', 'power', 'fuse', 'spark', 'wire', 'short', 'electricity'],
    reply: '⚡ Electrical hazard! Please stay away from wet areas and do not touch exposed wires. Turn off the main circuit breaker if safe, and book a certified Electrician from our app immediately.' },
  { keywords: ['ac', 'cool', 'heat', 'compressor', 'filter', 'dripping'],
    reply: '❄️ AC issue? If your AC is not cooling, it could be a dirty filter or low refrigerant. You can book a certified AC technician under the "AC Repair" service.' },
  { keywords: ['coupon', 'promo', 'discount', 'code', 'not working'],
    reply: '🎫 Promo code issues? Ensure the code is typed in ALL CAPS (e.g. FIRST50). Also check that your cart meets the minimum order amount and the code hasn\'t expired.' },
  { keywords: ['wallet', 'cashback', 'bonus', 'balance'],
    reply: '👛 Wallet questions? Referral bonuses and cashbacks are auto-credited to your wallet. Wallet balance will be applied automatically on your next checkout.' },
  { keywords: ['bug', 'crash', 'not loading', 'error', 'slow', 'app'],
    reply: '📱 App problem? Try restarting the app or clearing cache. If it still doesn\'t load, please reinstall the app or contact support at support@fixon.com.' },
  { keywords: ['contact', 'call', 'number', 'phone', 'email', 'support'],
    reply: '📞 Contact FixoN Support directly at 1800-FIXON-00 or email us at support@fixon.com. We are available 24/7!' },
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
    const liveInfo = users[u._id];
    const isOnline = liveInfo && liveInfo.lastSeen 
      ? (new Date() - new Date(liveInfo.lastSeen) < 60000)
      : false;

    userMap[u._id] = {
      ...u,
      location: liveInfo 
        ? { lat: liveInfo.lat, lng: liveInfo.lng, address: liveInfo.address || u.location?.address || '' } 
        : (u.location || {}),
      isOnline,
      lastSeen: liveInfo ? liveInfo.lastSeen : (u.lastSeen || null),
      totalBookings: bookings.filter(b => b.userId?._id === u._id).length,
    };
  });

  // 2. Add active users (live location tracks)
  Object.values(users).forEach(u => {
    if (!userMap[u._id]) {
      const isOnline = u.lastSeen ? (new Date() - new Date(u.lastSeen) < 60000) : false;
      userMap[u._id] = {
        _id: u._id,
        name: u.name || 'Customer',
        email: u.email || '',
        phone: u.phone || '',
        location: { lat: u.lat, lng: u.lng, address: u.address || '' },
        isOnline,
        lastSeen: u.lastSeen,
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
      const liveInfo = users[senderId];
      const isOnline = liveInfo && liveInfo.lastSeen ? (new Date() - new Date(liveInfo.lastSeen) < 120000) : false;
      userMap[senderId] = {
        _id: senderId,
        name: m.name || ('Customer ' + senderId.slice(-4)),
        email: senderId + '@fixon.com',
        phone: '',
        location: liveInfo ? { lat: liveInfo.lat, lng: liveInfo.lng, address: liveInfo.address || '' } : {},
        isOnline,
        lastSeen: liveInfo ? liveInfo.lastSeen : null,
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

  // Update persistent registeredUsers list
  const realUser = registeredUsers.find(u => u._id === userId);
  if (realUser) {
    realUser.location = { lat: parseFloat(lat), lng: parseFloat(lng), address: address || '' };
    realUser.lastSeen = new Date().toISOString();
  }

  if (!users[userId]) {
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

  // ✅ Also update currentLocation in adminWorkers so the map can show workers
  const adminWorker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
  if (adminWorker) {
    adminWorker.currentLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
    adminWorker.isOnline = true;
    console.log(`📍 Worker location: ${adminWorker.name} → ${lat}, ${lng}`);
  }

  io.emit('worker_location', { workerId, lat: workers[workerId].lat, lng: workers[workerId].lng });
  res.json({ success: true });
});


// Admin: get all LIVE customer locations (only online in last 60s)
app.get('/api/location/customers', (req, res) => {
  const ONLINE_THRESHOLD_MS = 60 * 1000; // 60 seconds
  const now = Date.now();
  const liveCustomers = Object.values(users)
    .filter(u => {
      if (!u.lat || !u.lastSeen) return false;
      return (now - new Date(u.lastSeen).getTime()) < ONLINE_THRESHOLD_MS;
    })
    .map(u => {
      // Enrich with phone + active booking service from registered users / bookings
      const regUser = registeredUsers.find(r => r._id === u._id);
      const activeBooking = bookings
        .filter(b => b.userId?._id === u._id && ['pending','accepted','on_the_way','ongoing'].includes(b.status))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      return {
        ...u,
        phone: regUser?.phone || u.phone || '',
        service: activeBooking?.service || null,
        bookingStatus: activeBooking?.status || null,
        lastUpdated: u.lastSeen,
      };
    });
  res.json({ success: true, customers: liveCustomers });
});

// ══════════════════════════════════════════════════════════════
//  BOOKING ROUTES (for mobile app — no separate backend)
// ══════════════════════════════════════════════════════════════

// Helper to dynamically enrich workerId with worker's average rating and booking photos
function enrichBooking(b) {
  if (!b) return b;
  const bookingCopy = { ...b };
  if (bookingCopy.workerId && bookingCopy.workerId._id) {
    const worker = adminWorkers.find(w => w._id === bookingCopy.workerId._id);
    bookingCopy.workerId = {
      ...bookingCopy.workerId,
      rating: worker?.rating || 4.5
    };
  }

  // Attach photos if present
  const photoData = bookingPhotos[bookingCopy._id];
  const beforePhoto = photoData?.beforePhoto || b.beforePhoto || b.problemPhoto || null;
  const afterPhoto = photoData?.afterPhoto || b.afterPhoto || null;

  bookingCopy.beforePhoto = beforePhoto;
  bookingCopy.afterPhoto = afterPhoto;
  bookingCopy.problemPhoto = b.problemPhoto || beforePhoto;

  if (photoData) {
    bookingCopy.beforePhotoUploadedAt = photoData.beforePhotoUploadedAt || null;
    bookingCopy.afterPhotoUploadedAt = photoData.afterPhotoUploadedAt || null;
  }

  return bookingCopy;
}

// ── Upload Before/After Photos for a Booking ─────────────────
app.post('/api/bookings/:id/photos', async (req, res) => {
  const bookingId = req.params.id;
  const { beforePhoto, afterPhoto, workerNotes, completionNotes } = req.body;

  if (!bookingPhotos[bookingId]) bookingPhotos[bookingId] = {};

  if (beforePhoto) {
    bookingPhotos[bookingId].beforePhoto = beforePhoto;
    bookingPhotos[bookingId].beforePhotoUploadedAt = new Date().toISOString();
  }
  if (afterPhoto) {
    bookingPhotos[bookingId].afterPhoto = afterPhoto;
    bookingPhotos[bookingId].afterPhotoUploadedAt = new Date().toISOString();
  }
  if (workerNotes)     bookingPhotos[bookingId].workerNotes = workerNotes;
  if (completionNotes) bookingPhotos[bookingId].completionNotes = completionNotes;

  // Also store on the booking object itself for persistence
  const b = bookings.find(x => x._id === bookingId);
  if (b) {
    if (beforePhoto) b.beforePhoto = beforePhoto;
    if (afterPhoto)  b.afterPhoto  = afterPhoto;
    if (workerNotes)     b.workerNotes = workerNotes;
    if (completionNotes) b.completionNotes = completionNotes;
  }

  // Persist photos to MongoDB separately (large data)
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      await BookingPhoto.findOneAndUpdate(
        { bookingId },
        { bookingId, ...bookingPhotos[bookingId] },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('⚠️ Failed to save photo to MongoDB:', err.message);
    }
  }

  saveData();

  // Notify admin and customer about photo upload
  io.emit('booking_photos_updated', {
    bookingId,
    beforePhoto: bookingPhotos[bookingId].beforePhoto || null,
    afterPhoto: bookingPhotos[bookingId].afterPhoto || null,
  });

  const photoType = beforePhoto ? 'Before' : 'After';
  console.log(`📸 ${photoType} photo uploaded for booking ${bookingId}`);
  res.json({ success: true, photos: bookingPhotos[bookingId], booking: b ? enrichBooking(b) : null });
});

// GET photos for a booking
app.get('/api/bookings/:id/photos', async (req, res) => {
  const bookingId = req.params.id;
  let photos = bookingPhotos[bookingId] || {};

  // Try MongoDB if not in memory
  if ((!photos.beforePhoto && !photos.afterPhoto) && MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await BookingPhoto.findOne({ bookingId }).lean();
      if (doc) {
        bookingPhotos[bookingId] = doc;
        photos = doc;
      }
    } catch {}
  }

  res.json({ success: true, photos });
});

// Mobile app creates a booking  /  Admin seed import
app.post('/api/bookings', (req, res) => {
  const {
    userId, service, price, category, scheduledTime, lat, lng, address, name,
    // Extended fields from seed/admin:
    status, workerId, workerName, city, discount, couponCode,
    rating, ratingComment, completedAt, description,
    userName, userPhone,
    paymentMethod, paymentStatus,
    beforePhoto, problemPhoto,
  } = req.body;

  // Resolve user name
  const realUser = registeredUsers.find(u => u._id === userId);
  const finalName = name || userName || realUser?.name || 'Customer';
  const photo = beforePhoto || problemPhoto || null;

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
    paymentMethod: paymentMethod || 'Online (UPI)',
    paymentStatus: paymentStatus || 'Pending',
    createdAt: req.body.createdAt || new Date().toISOString(),
    completedAt: completedAt || (status === 'completed' ? new Date().toISOString() : null),
  };

  bookings.push(booking);
  saveData();

  io.emit('new_booking', booking);
  console.log(`📦 Booking [${booking.status}]: ${booking.service} by ${finalName}`);

  res.json({ success: true, booking: enrichBooking(booking) });
});


// Mobile app: get user's bookings
app.get('/api/bookings/user/:userId', (req, res) => {
  const userBookings = bookings.filter(b => b.userId?._id === req.params.userId);
  res.json({ success: true, bookings: userBookings.map(enrichBooking).reverse() });
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

  res.json({ success: true, booking: enrichBooking(b) });
});

// Admin: get all bookings — always fetch latest from MongoDB if connected
app.get('/api/bookings', async (req, res) => {
  // If MongoDB is connected, reload from DB to get bookings created via Render cloud
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc && doc.bookings) {
        // Merge: keep in-memory bookings that are newer/missing from DB
        const dbIds = new Set(doc.bookings.map(b => b._id));
        const onlyInMemory = bookings.filter(b => !dbIds.has(b._id));
        bookings = [...doc.bookings, ...onlyInMemory];
      }
    } catch (err) {
      // Fall through to in-memory
    }
  }
  res.json({ success: true, bookings: bookings.map(enrichBooking).reverse() });
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
  res.json({ success: true, bookings: bookings.map(enrichBooking).reverse() });
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
  res.json({ success: true, booking: enrichBooking(b) });
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

// Worker SELF-Registration (from worker app — no credentials yet, pending admin review)
app.post('/api/workers/register', (req, res) => {
  const { name, email, phone, address, city, category, experience,
          aadhaarNumber, panNumber, aadhaarPhotoUrl, panPhotoUrl,
          profilePhotoUrl, bankAccount, bankIFSC, bankName } = req.body;

  if (!name || !phone || !category) {
    return res.status(400).json({ success: false, error: 'Name, phone and category are required' });
  }

  // Prevent duplicate phone
  const existing = adminWorkers.find(w => w.phone === phone);
  if (existing) {
    const status = existing.registrationStatus || (existing.isActive ? 'approved' : 'pending');
    return res.json({ success: false, error: 'Phone already registered. Check your application status.', status });
  }

  const newWorker = {
    _id: 'W' + Date.now(),
    name: name.trim(),
    email: (email || '').trim(),
    phone: phone.trim(),
    address: (address || '').trim(),
    city: city || 'Hyderabad',
    category,
    skills: [category],
    experience: experience || '',
    aadhaar: aadhaarNumber || '',
    pan: panNumber || '',
    profilePhotoUrl: profilePhotoUrl || '',
    aadhaarPhotoUrl: aadhaarPhotoUrl || '',
    panPhotoUrl: panPhotoUrl || '',
    bankDetails: { account: bankAccount || '', ifsc: bankIFSC || '', bankName: bankName || '' },
    rating: 0,
    active: false,
    isAvailable: false,
    isActive: false,
    isOnline: false,
    isBlocked: false,
    aadhaarVerified: false,
    panVerified: false,
    registrationStatus: 'pending',
    createdAt: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
  };

  adminWorkers.push(newWorker);
  saveData();
  io.emit('worker_registered', newWorker);
  console.log(`🆕 Worker self-registered: ${name} (${phone}) — awaiting admin approval`);
  res.json({ success: true, worker: newWorker, message: 'Registration submitted! Admin will review within 24 hours.' });
});

// Check worker registration status by phone number
app.get('/api/workers/registration-status/:phone', (req, res) => {
  const w = adminWorkers.find(x => x.phone === req.params.phone);
  if (!w) return res.status(404).json({ success: false, error: 'No registration found for this phone number' });
  const status = w.registrationStatus || (w.isActive ? 'approved' : 'pending');
  res.json({
    success: true,
    status,
    name: w.name,
    workerId: status === 'approved' ? (w.workerId || null) : null,
    workerPassword: status === 'approved' ? (w.workerPassword || null) : null,
    rejectionReason: w.rejectionReason || null,
  });
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
//  WORKER VERIFICATION & APP ENDPOINTS
// ══════════════════════════════════════════════════════════════

// Worker submits document for verification (Aadhaar or PAN)
app.post('/api/workers/:id/verify-document', (req, res) => {
  const { documentType, documentNumber, documentFrontUrl, documentBackUrl } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id || x.phone === req.params.id || x.workerId === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  if (documentType === 'Aadhaar') {
    w.aadhaar = documentNumber || w.aadhaar;
    if (documentFrontUrl) w.aadhaarPhotoUrl = documentFrontUrl;
    if (documentBackUrl) w.aadhaarBackUrl = documentBackUrl;
    w.aadhaarVerified = false;
  } else if (documentType === 'PAN') {
    w.pan = documentNumber || w.pan;
    if (documentFrontUrl) w.panPhotoUrl = documentFrontUrl;
    w.panVerified = false;
  }

  w.documentStatus = 'pending';
  saveData();
  io.emit('worker_document_submitted', { workerId: w._id, documentType, documentNumber });
  console.log(`🪪 Document [${documentType}] submitted for worker ${w.name}`);
  res.json({ success: true, message: 'Document submitted for review', worker: w });
});

// Admin approves worker application
app.post('/api/workers/:id/approve', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.isActive = true;
  w.active = true;
  w.registrationStatus = 'approved';

  if (!w.workerId || !w.workerPassword) {
    const count = adminWorkers.filter(x => x.category === w.category && x.workerId).length;
    const creds = generateWorkerCredentials(w.category, count);
    w.workerId = creds.workerId;
    w.workerPassword = creds.password;
  }

  saveData();
  io.emit('worker_approved', w);
  console.log(`✅ Worker ${w.name} approved! ID: ${w.workerId}`);
  res.json({ success: true, worker: w });
});

// Admin rejects worker application
app.post('/api/workers/:id/reject', (req, res) => {
  const { reason } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.isActive = false;
  w.active = false;
  w.registrationStatus = 'rejected';
  w.rejectionReason = reason || 'Application rejected by admin';

  saveData();
  io.emit('worker_rejected', w);
  console.log(`❌ Worker ${w.name} rejected: ${w.rejectionReason}`);
  res.json({ success: true, worker: w });
});

// Admin blocks / unblocks worker
app.post('/api/workers/:id/block', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.isBlocked = !w.isBlocked;
  if (w.isBlocked) {
    w.isActive = false;
    w.active = false;
    w.isOnline = false;
  }
  saveData();
  io.emit('worker_updated', w);
  console.log(`🔒 Worker ${w.name} isBlocked: ${w.isBlocked}`);
  res.json({ success: true, blocked: w.isBlocked, worker: w });
});

// Admin resets worker password
app.post('/api/workers/:id/reset-password', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  const newPass = 'FXN' + Math.floor(1000 + Math.random() * 9000);
  w.workerPassword = newPass;
  saveData();
  console.log(`🔑 New password generated for worker ${w.name}: ${newPass}`);
  res.json({ success: true, workerId: w.workerId, newPassword: newPass, worker: w });
});

// Admin approves Aadhaar document
app.post('/api/workers/:id/approve-aadhaar', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.aadhaarVerified = true;
  saveData();
  io.emit('worker_updated', w);
  console.log(`🪪 Aadhaar approved for worker ${w.name}`);
  res.json({ success: true, worker: w });
});

// Admin approves PAN document
app.post('/api/workers/:id/approve-pan', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.panVerified = true;
  saveData();
  io.emit('worker_updated', w);
  console.log(`💳 PAN approved for worker ${w.name}`);
  res.json({ success: true, worker: w });
});

// Worker App Login
app.post('/api/worker/login', (req, res) => {
  const { workerId, password } = req.body;
  if (!workerId || !password) {
    return res.status(400).json({ success: false, error: 'Worker ID and password required' });
  }

  const worker = adminWorkers.find(
    w => (w.workerId === workerId || w.phone === workerId || w.email === workerId) &&
         (w.workerPassword === password || w.password === password)
  );

  if (!worker) {
    return res.status(401).json({ success: false, error: 'Invalid Worker ID or password' });
  }

  if (worker.isBlocked) {
    return res.status(403).json({ success: false, error: 'Your account has been blocked by admin.' });
  }

  worker.isOnline = true;
  saveData();

  res.json({
    success: true,
    token: 'WT' + Date.now(),
    worker
  });
});

// Worker Dashboard Stats
app.get('/api/worker/:id/dashboard', (req, res) => {
  const workerId = req.params.id;
  const worker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
  if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });

  const workerBookings = bookings.filter(b =>
    (b.workerId === workerId || b.workerId?._id === workerId || b.workerId?.workerId === workerId || (worker && b.workerId?.name === worker.name))
  );

  const completed = workerBookings.filter(b => b.status === 'completed');
  const pending = workerBookings.filter(b => b.status === 'accepted' || b.status === 'assigned');
  const earnings = completed.reduce((sum, b) => sum + Math.round((b.price || 0) * 0.7), 0);

  res.json({
    success: true,
    stats: {
      totalJobs: completed.length,
      pendingJobs: pending.length,
      totalEarnings: earnings,
      rating: worker.rating || 5.0,
      isOnline: worker.isOnline || false,
    }
  });
});

// Worker Pending Bookings (Jobs assigned or matching category)
app.get('/api/worker/:id/pending-bookings', (req, res) => {
  const workerId = req.params.id;
  const worker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
  const wId = worker ? worker._id : workerId;

  const pending = bookings.filter(b => {
    // Exclude if already accepted, completed, or cancelled
    if (['accepted', 'on_the_way', 'ongoing', 'in_progress', 'completed', 'cancelled'].includes(b.status)) {
      return false;
    }
    // Exclude if rejected by this worker
    if (b.rejectedBy && Array.isArray(b.rejectedBy) && (b.rejectedBy.includes(workerId) || b.rejectedBy.includes(wId))) {
      return false;
    }

    const isAssignedToMe = (
      b.workerId === workerId ||
      b.workerId === wId ||
      b.workerId?._id === workerId ||
      b.workerId?._id === wId ||
      (worker && b.workerId?.name === worker.name)
    );
    const isCategoryMatch = (!b.workerId || !b.workerId._id) && (b.category === worker?.category || b.service === worker?.category);

    return (isAssignedToMe || isCategoryMatch) && (b.status === 'pending' || b.status === 'assigned');
  });

  res.json({ success: true, bookings: pending.map(enrichBooking).reverse() });
});

// Worker Assigned/My Bookings
app.get('/api/worker/:id/bookings', (req, res) => {
  const workerId = req.params.id;
  const worker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
  const wId = worker ? worker._id : workerId;

  const myJobs = bookings.filter(b => {
    const isAssignedToMe = (
      b.workerId === workerId ||
      b.workerId === wId ||
      b.workerId?._id === workerId ||
      b.workerId?._id === wId ||
      (worker && b.workerId?.name === worker.name)
    );
    // Show in My Jobs if assigned to me and status is accepted / on_the_way / ongoing / completed
    return isAssignedToMe && (b.status !== 'pending' || b.assignedTo === wId || b.assignedTo === workerId);
  });

  res.json({ success: true, bookings: myJobs.map(enrichBooking).reverse() });
});

// Worker Accept Booking
app.post('/api/worker/:id/accept-booking/:bookingId', (req, res) => {
  const workerId = req.params.id;
  const worker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });

  b.status = 'accepted';
  b.acceptedAt = new Date().toISOString();
  if (worker) {
    b.workerId = { _id: worker._id, name: worker.name, phone: worker.phone, rating: worker.rating || 5.0 };
    b.assignedWorker = worker.name;
  }
  saveData();

  // Notify customer
  const customerId = b.userId?._id || b.userId;
  if (customerId) {
    const custNotif = {
      _id: 'N' + Date.now(),
      userId: customerId,
      title: '✅ Booking Accepted!',
      message: `${worker?.name || 'Worker'} has accepted your ${b.service} booking.`,
      type: 'booking',
      bookingId: b._id,
      status: 'accepted',
      createdAt: new Date().toISOString(),
      read: false,
    };
    notificationsList.push(custNotif);
    io.emit('new_notification', custNotif);
    io.emit('booking_status_update', { userId: customerId, bookingId: b._id, status: 'accepted', booking: enrichBooking(b) });
  }

  // Real-time broadcast to all (Admin, Worker, Customer)
  io.emit('booking_update', { bookingId: b._id, status: 'accepted', booking: enrichBooking(b) });
  console.log(`✅ Worker ${worker?.name || workerId} accepted booking ${b._id}`);
  res.json({ success: true, booking: enrichBooking(b) });
});

// Worker Reject Booking
app.post('/api/worker/:id/reject-booking/:bookingId', (req, res) => {
  const workerId = req.params.id;
  const worker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
  const wId = worker ? worker._id : workerId;
  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });

  b.status = 'pending';
  b.workerId = null;
  b.rejectedBy = b.rejectedBy || [];
  if (!b.rejectedBy.includes(workerId)) b.rejectedBy.push(workerId);
  if (wId && !b.rejectedBy.includes(wId)) b.rejectedBy.push(wId);

  saveData();

  io.emit('booking_update', { bookingId: b._id, status: 'pending', booking: enrichBooking(b) });
  console.log(`❌ Worker ${worker?.name || workerId} rejected booking ${b._id}`);
  res.json({ success: true, booking: enrichBooking(b) });
});

// GET invoice for a booking
app.get('/api/bookings/:id/invoice', (req, res) => {
  const b = bookings.find(x => x._id === req.params.id);
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });

  const basePrice = b.price || 0;
  const discount = b.discount || 0;
  const platformFee = Math.round(basePrice * 0.05);
  const gstTax = Math.round((basePrice + platformFee - discount) * 0.18);
  const totalAmount = basePrice + platformFee + gstTax - discount;

  const invoice = {
    invoiceNumber: `INV-${new Date(b.createdAt || Date.now()).getFullYear()}-${b._id.replace(/[^0-9]/g, '').slice(-6)}`,
    bookingId: b._id,
    customerName: b.userName || b.userId?.name || 'Customer',
    customerPhone: b.userPhone || b.userId?.phone || '',
    customerAddress: b.location?.address || b.address || '',
    workerName: b.workerId?.name || b.workerName || 'Assigned Worker',
    workerPhone: b.workerId?.phone || '',
    serviceCategory: b.category || b.service,
    serviceName: b.service,
    bookingDate: b.createdAt || b.scheduledTime,
    completionDate: b.completedAt || new Date().toISOString(),
    labourCharge: basePrice,
    materialCharge: b.materialCharge || 0,
    platformFee: platformFee,
    discount: discount,
    gstTax: gstTax,
    totalAmount: totalAmount,
    paymentStatus: b.paymentStatus || 'Paid',
    paymentMethod: b.paymentMethod || 'Online (UPI)',
  };

  res.json({ success: true, invoice });
});

// Worker Update Job Status (on-the-way, arrived, start, complete, cancel)
app.post('/api/worker/:id/booking/:bookingId/:action', (req, res) => {
  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });

  const action = req.params.action;
  let newStatus = action;
  if (action === 'on-the-way')   newStatus = 'on_the_way';
  if (action === 'arrived')      newStatus = 'arrived';
  if (action === 'start')        newStatus = 'ongoing';
  if (action === 'in_progress')  newStatus = 'ongoing';
  if (action === 'complete')     newStatus = 'completed';
  if (action === 'cancel')       newStatus = 'cancelled';

  b.status = newStatus;
  if (newStatus === 'completed') {
    b.completedAt = new Date().toISOString();
  }
  if (newStatus === 'ongoing') {
    b.startedAt = new Date().toISOString();
  }
  saveData();

  // ── Notify customer for each step ─────────────────────────
  const customerId = b.userId?._id || b.userId;
  const notifMessages = {
    on_the_way:  { title: '🏍️ Worker On The Way!',  msg: `Your ${b.service} worker is on the way to you.` },
    arrived:     { title: '📍 Worker Arrived!',     msg: `Your ${b.service} worker has arrived at your location.` },
    ongoing:     { title: '🔧 Work Started!',         msg: `Work has started for your ${b.service} booking.` },
    completed:   { title: '🎉 Job Completed!',        msg: `Your ${b.service} booking has been completed!` },
    cancelled:   { title: '❌ Booking Cancelled',     msg: `Your ${b.service} booking was cancelled.` },
  };
    completed:   { title: '✅ Job Completed!',         msg: `Your ${b.service} job is complete! Please rate your worker.` },
    cancelled:   { title: '❌ Booking Cancelled',     msg: `Your ${b.service} booking has been cancelled by the worker.` },
  };

  if (customerId && notifMessages[newStatus]) {
    const n = notifMessages[newStatus];
    const custNotif = {
      _id: 'N' + Date.now(),
      userId: customerId,
      title: n.title,
      message: n.msg,
      type: 'booking',
      bookingId: b._id,
      status: newStatus,
      createdAt: new Date().toISOString(),
      read: false,
    };
    notificationsList.push(custNotif);
    io.emit('new_notification', custNotif);
    io.emit('booking_status_update', { userId: customerId, bookingId: b._id, status: newStatus, booking: enrichBooking(b) });
  }

  io.emit('booking_update', { bookingId: b._id, status: newStatus, booking: enrichBooking(b) });
  console.log(`🛠️ Worker updated booking ${b._id} status → ${newStatus}`);
  res.json({ success: true, booking: enrichBooking(b) });
});

// Worker Toggle Online Status
app.put('/api/worker/:id/status', (req, res) => {
  const { isOnline } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.isOnline = !!isOnline;
  saveData();

  io.emit('worker_status_changed', { workerId: w._id, isOnline: w.isOnline });
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
    booking.rated = true;
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



// ── Customer-facing: always read fresh from MongoDB so Admin Panel price changes reflect immediately
app.get('/api/services', async (req, res) => {
  // If MongoDB is connected, reload services fresh from DB every request
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc && doc.services && doc.services.length > 0) {
        services = doc.services; // update in-memory cache
      }
    } catch (e) {
      console.error('⚠️ Failed to refresh services from MongoDB:', e.message);
    }
  }
  res.json({ success: true, services: services.filter(s => s.active !== false) });
});

app.get('/api/admin/services', (req, res) => {
  res.json({ success: true, services });
});

app.post('/api/admin/services', async (req, res) => {
  const s = { _id: 'SV' + Date.now(), ...req.body, active: true };
  services.push(s);
  await saveData();
  res.json({ success: true, service: s });
});

app.put('/api/admin/services/:id', async (req, res) => {
  const idx = services.findIndex(s => s._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  services[idx] = { ...services[idx], ...req.body };
  await saveData();
  console.log(`✅ Service "${services[idx].name}" updated → price ₹${services[idx].price} saved to MongoDB`);
  res.json({ success: true, service: services[idx] });
});

app.delete('/api/admin/services/:id', async (req, res) => {
  services = services.filter(s => s._id !== req.params.id);
  await saveData();
  res.json({ success: true });
});

// ── Admin: force reload all data from MongoDB (useful after external changes)
app.post('/api/admin/reload-data', async (req, res) => {
  try {
    await loadData();
    res.json({ success: true, message: 'Data reloaded from MongoDB Atlas', serviceCount: services.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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

// Map: socketId → userId  (so we know WHICH customer disconnected)
const socketToUser = {};

// Periodically clean up offline users/locations from memory (every 15s) to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const OFFLINE_THRESHOLD = 60 * 1000; // 60 seconds
  Object.keys(users).forEach(userId => {
    const u = users[userId];
    if (u) {
      const lastSeenTime = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
      const timeSinceLastSeen = now - lastSeenTime;
      
      // If no updates in 60s, double-check if socket is still active
      if (timeSinceLastSeen > OFFLINE_THRESHOLD) {
        const activeSocket = u.socketId ? io.sockets.sockets.get(u.socketId) : null;
        if (!activeSocket) {
          console.log(`🧹 Periodic cleanup: removing inactive customer ${u.name || userId} from memory`);
          io.emit('user_offline', { userId });
          delete users[userId];
        }
      }
    }
  });
}, 15000);

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Admin panel joins — send only LIVE customers (active in last 60s)
  socket.on('admin_join', () => {
    console.log('👑 Admin panel connected');
    const ONLINE_MS = 60 * 1000;
    const now = Date.now();
    Object.values(users)
      .filter(u => u.lat && u.lastSeen && (now - new Date(u.lastSeen).getTime()) < ONLINE_MS)
      .forEach(u => {
        socket.emit('user_location', { userId: u._id, name: u.name, lat: u.lat, lng: u.lng, address: u.address });
      });
  });

  // Customer app opens → register this socket ↔ userId mapping
  socket.on('customer_join', (data) => {
    const userId = data?.userId;
    if (userId) {
      socketToUser[socket.id] = userId;
      // Make sure this user exists in our map
      if (!users[userId]) {
        const realUser = registeredUsers.find(u => u._id === userId);
        users[userId] = { _id: userId, name: data.name || realUser?.name || 'Customer', email: realUser?.email || '' };
      }
      users[userId].socketId = socket.id;
      users[userId].lastSeen = new Date().toISOString();
      console.log(`👤 Customer online: ${users[userId].name} (${userId})`);
    }
  });

  // Client disconnects → immediately mark customer offline
  socket.on('disconnect', () => {
    const userId = socketToUser[socket.id];
    if (userId && users[userId]) {
      // ONLY mark offline / delete if this socket is the active one for the user (prevents race conditions)
      if (users[userId].socketId === socket.id) {
        console.log(`📴 Customer offline: ${users[userId].name} (${userId})`);
        io.emit('user_offline', { userId });
        delete users[userId]; // Delete from users map completely to free memory
      } else {
        console.log(`ℹ️ Socket disconnect ignored for user ${userId} (reconnected on socket: ${users[userId].socketId})`);
      }
    }
    delete socketToUser[socket.id];
    console.log('❌ Disconnected:', socket.id);
  });
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

  if (!bookingPhotos[b._id]) {
    bookingPhotos[b._id] = { bookingId: b._id };
  }

  const p = bookingPhotos[b._id];
  if (beforePhoto !== undefined) {
    p.beforePhoto = beforePhoto;
    p.beforePhotoUploadedAt = new Date().toISOString();
  }
  if (afterPhoto !== undefined) {
    p.afterPhoto = afterPhoto;
    p.afterPhotoUploadedAt = new Date().toISOString();
  }

  savePhotos(b._id);
  
  // We emit the enriched booking (with photos) so listening apps get the photos immediately
  const enriched = enrichBooking(b);
  io.emit('booking_update', { bookingId: b._id, status: b.status, booking: enriched });
  console.log(`📸 Photos updated for booking ${b._id}: before=${!!p.beforePhoto}, after=${!!p.afterPhoto}`);
  res.json({ success: true, booking: enriched });
});

// 2. Submit Worker Document Verification — supports separate Aadhaar and PAN
app.post('/api/workers/:id/verify-document', (req, res) => {
  const { documentType, documentNumber, documentFrontUrl, documentBackUrl } = req.body;
  // Find worker by _id OR workerId (so worker app can send either)
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) {
    console.log(`❌ verify-document: worker not found for id=${req.params.id}`);
    return res.status(404).json({ success: false, error: 'Worker not found. Make sure you are logged in to the worker app.' });
  }

  if (documentType === 'Aadhaar') {
    if (documentNumber) w.aadhaar = documentNumber;
    if (documentFrontUrl) w.aadhaarPhotoUrl = documentFrontUrl;
    if (documentBackUrl) w.aadhaarBackUrl = documentBackUrl;
    w.aadhaarVerification = {
      documentType: 'Aadhaar',
      documentNumber: documentNumber || w.aadhaar || '',
      documentFrontUrl: documentFrontUrl || w.aadhaarPhotoUrl || '',
      documentBackUrl: documentBackUrl || w.aadhaarBackUrl || '',
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    // Also update legacy field
    w.verification = w.aadhaarVerification;
  } else if (documentType === 'PAN') {
    if (documentNumber) w.pan = documentNumber;
    if (documentFrontUrl) w.panPhotoUrl = documentFrontUrl;
    if (documentBackUrl) w.panBackUrl = documentBackUrl;
    w.panVerification = {
      documentType: 'PAN',
      documentNumber: documentNumber || w.pan || '',
      documentFrontUrl: documentFrontUrl || w.panPhotoUrl || '',
      documentBackUrl: documentBackUrl || w.panBackUrl || '',
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
  }

  saveData();
  io.emit('worker_updated', w);
  console.log(`📋 ${documentType} document submitted by worker: ${w.name} (${w._id})`);
  res.json({ success: true, worker: w });
});

// 3. Admin: Update document verification status (legacy endpoint)
app.post('/api/admin/workers/:id/verify-status', (req, res) => {
  const { status, rejectionReason, documentType } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  if (documentType === 'Aadhaar' || (!documentType && w.aadhaarVerification)) {
    if (w.aadhaarVerification) { w.aadhaarVerification.status = status; w.aadhaarVerification.verifiedAt = new Date().toISOString(); }
    if (status === 'approved') { w.aadhaarVerified = true; w.aadhaarVerifiedAt = new Date().toISOString(); }
    if (rejectionReason && w.aadhaarVerification) w.aadhaarVerification.rejectionReason = rejectionReason;
  }
  if (documentType === 'PAN' || (!documentType && w.panVerification)) {
    if (w.panVerification) { w.panVerification.status = status; w.panVerification.verifiedAt = new Date().toISOString(); }
    if (status === 'approved') { w.panVerified = true; w.panVerifiedAt = new Date().toISOString(); }
    if (rejectionReason && w.panVerification) w.panVerification.rejectionReason = rejectionReason;
  }
  if (w.verification) { w.verification.status = status; w.verification.verifiedAt = new Date().toISOString(); }

  saveData();
  io.emit('worker_updated', w);
  res.json({ success: true, worker: w });
});

// 4. Admin: APPROVE Worker (generates credentials if needed)
app.post('/api/admin/workers/:id/approve', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  if (!w.workerId) {
    const sameCatCount = adminWorkers.filter(x => x.category === w.category && x.workerId).length;
    const creds = generateWorkerCredentials(w.category, sameCatCount);
    w.workerId = creds.workerId;
    w.workerPassword = creds.password;
    w.credentialsGeneratedAt = new Date().toISOString();
  }

  w.registrationStatus = 'approved';
  w.active = true;
  w.isActive = true;
  w.isAvailable = true;
  w.isBlocked = false;
  w.approvedAt = new Date().toISOString();
  if (w.aadhaar || w.aadhaarPhotoUrl) { w.aadhaarVerified = true; if (w.aadhaarVerification) w.aadhaarVerification.status = 'approved'; }
  if (w.pan || w.panPhotoUrl) { w.panVerified = true; if (w.panVerification) w.panVerification.status = 'approved'; }
  if (w.verification) { w.verification.status = 'approved'; w.verification.verifiedAt = new Date().toISOString(); }

  saveData();
  io.emit('worker_updated', w);
  console.log(`✅ Worker APPROVED: ${w.name} → ID: ${w.workerId} / Pass: ${w.workerPassword}`);
  res.json({ success: true, worker: w });
});

// 5. Admin: REJECT Worker
app.post('/api/admin/workers/:id/reject', (req, res) => {
  const { reason } = req.body;
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.registrationStatus = 'rejected';
  w.rejectionReason = reason || 'Application rejected by admin';
  w.active = false;
  w.isActive = false;
  w.rejectedAt = new Date().toISOString();
  if (w.verification) { w.verification.status = 'rejected'; w.verification.rejectionReason = reason; }
  if (w.aadhaarVerification) { w.aadhaarVerification.status = 'rejected'; }
  if (w.panVerification) { w.panVerification.status = 'rejected'; }

  saveData();
  io.emit('worker_updated', w);
  console.log(`❌ Worker REJECTED: ${w.name}`);
  res.json({ success: true, worker: w });
});

// 6. Admin: BLOCK / UNBLOCK Worker
app.post('/api/admin/workers/:id/block', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.isBlocked = !w.isBlocked;
  if (w.isBlocked) {
    w.active = false; w.isActive = false; w.isAvailable = false;
    w.registrationStatus = 'blocked';
  } else {
    w.active = true; w.isActive = true;
    w.registrationStatus = 'approved';
  }
  saveData();
  io.emit('worker_updated', w);
  console.log(`🔒 Worker ${w.isBlocked ? 'BLOCKED' : 'UNBLOCKED'}: ${w.name}`);
  res.json({ success: true, blocked: w.isBlocked, worker: w });
});

// 7. Admin: RESET Worker Password
app.post('/api/admin/workers/:id/reset-password', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  const newPassword = 'FXN' + Math.floor(1000 + Math.random() * 9000);
  w.workerPassword = newPassword;
  w.passwordResetAt = new Date().toISOString();
  saveData();
  console.log(`🔑 Password reset for worker ${w.name}: ${newPassword}`);
  res.json({ success: true, newPassword, workerId: w.workerId, worker: w });
});

// 8. Admin: Approve individual document (Aadhaar or PAN)
app.post('/api/admin/workers/:id/approve-aadhaar', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });
  w.aadhaarVerified = true; w.aadhaarVerifiedAt = new Date().toISOString();
  if (w.aadhaarVerification) w.aadhaarVerification.status = 'approved';
  saveData(); io.emit('worker_updated', w);
  res.json({ success: true, worker: w });
});

app.post('/api/admin/workers/:id/approve-pan', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });
  w.panVerified = true; w.panVerifiedAt = new Date().toISOString();
  if (w.panVerification) w.panVerification.status = 'approved';
  saveData(); io.emit('worker_updated', w);
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
  res.json({ success: true, bookings: myBookings.map(enrichBooking) });
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
  res.json({ success: true, bookings: pending.map(enrichBooking) });
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
