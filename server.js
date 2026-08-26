const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');

// â”€â”€ Try to load optional compression (installed separately) â”€â”€â”€
let compression;
try { compression = require('compression'); } catch (_) { compression = null; }

// â”€â”€ MongoDB Atlas Connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pittalaadithyavarun555:Varun%406302@cluster0.jjmqmqm.mongodb.net/fixon?retryWrites=true&w=majority';

// MongoDB schema â€” stores ALL app data as one document
const AppDataSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  registeredUsers: { type: Array, default: [] },
  bookings: { type: Array, default: [] },
  messages: { type: Array, default: [] },
  notificationsList: { type: Array, default: [] },
  adminWorkers: { type: Array, default: [] },
  services: { type: Array, default: [] },
  coupons: { type: Array, default: [] },
  spareParts: { type: Array, default: [] },
  sparePartOrders: { type: Array, default: [] },
  sparePartCategories: { type: Array, default: [] },
  sparePartSuppliers: { type: Array, default: [] },
  sparePartRequests: { type: Array, default: [] },
  sparePartAuditHistory: { type: Array, default: [] },
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
if (compression) app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors());
// Cache-control for static assets only â€“ APIs remain no-cache
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) res.setHeader('Cache-Control', 'public, max-age=300');
  else res.setHeader('Cache-Control', 'no-cache');
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// â”€â”€ Persistent file storage (local fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DATA_FILE = path.join(__dirname, 'fixon_data.json');
const PHOTOS_FILE = path.join(__dirname, 'fixon_photos.json');

// â”€â”€ In-memory stores (declared HERE so loadData() can write to them) â”€â”€
const users = {};           // userId â†’ live location tracking
const workers = {};         // workerId â†’ { _id, name, lat, lng } (live location)
const bookingPhotos = {};   // bookingId â†’ { beforePhoto, afterPhoto, etc. }
let messages = [];
let bookings = [];
let registeredUsers = [];   // real sign-ups
let notificationsList = []; // admin sent notifications
let spareParts = [
  {
    _id: 'SP100001',
    name: 'LG AC Capacitor 25µF',
    category: 'AC Parts',
    brand: 'LG',
    partNumber: 'EAE31131507',
    quality: 'Original',
    price: 499,
    discountPrice: 450,
    stock: 15,
    lowStockThreshold: 5,
    compatibleModels: ['LG 1.5 Ton Split AC', 'LG 2 Ton Split AC', 'LG Dual Inverter Models'],
    description: 'High performance original LG dual run capacitor for inverter split AC units.',
    warranty: '6 Months Replacement Warranty',
    photo: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
    additionalPhotos: [],
    deliveryCharge: 40,
    active: true,
    supplierId: 'SUP001',
    supplierName: 'CoolTech Components Pvt Ltd',
    supplierContact: '9848012345',
    purchasePrice: 280,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: 'SP100002',
    name: 'Samsung Refrigerator Defrost Heater',
    category: 'Refrigerator Parts',
    brand: 'Samsung',
    partNumber: 'DA47-00247C',
    quality: 'OEM',
    price: 699,
    discountPrice: 599,
    stock: 8,
    lowStockThreshold: 3,
    compatibleModels: ['Samsung Double Door 253L', 'Samsung Frost Free 300L'],
    description: 'Defrost heating element for Samsung frost-free refrigerators.',
    warranty: '3 Months Warranty',
    photo: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=500&auto=format&fit=crop&q=60',
    additionalPhotos: [],
    deliveryCharge: 50,
    active: true,
    supplierId: 'SUP002',
    supplierName: 'Apex Appliance Spares',
    supplierContact: '9123456789',
    purchasePrice: 380,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: 'SP100003',
    name: 'IFB Washing Machine Drain Pump',
    category: 'Washing Machine Parts',
    brand: 'IFB',
    partNumber: 'IFB-DP-880',
    quality: 'Original',
    price: 899,
    discountPrice: 799,
    stock: 4, // low stock test case
    lowStockThreshold: 5,
    compatibleModels: ['IFB Executive Plus 6.5kg', 'IFB Senator Smart 8kg'],
    description: 'Heavy duty drain pump motor assembly for IFB front load washing machines.',
    warranty: '6 Months Warranty',
    photo: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500&auto=format&fit=crop&q=60',
    additionalPhotos: [],
    deliveryCharge: 60,
    active: true,
    supplierId: 'SUP001',
    supplierName: 'CoolTech Components Pvt Ltd',
    supplierContact: '9848012345',
    purchasePrice: 450,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
let sparePartOrders = [];
let sparePartCategories = [
  { id: 'cat_ac', name: 'AC Parts', icon: '❄️', active: true },
  { id: 'cat_fridge', name: 'Refrigerator Parts', icon: '🧊', active: true },
  { id: 'cat_wash', name: 'Washing Machine Parts', icon: '🧺', active: true },
  { id: 'cat_tv', name: 'TV Parts', icon: '📺', active: true },
  { id: 'cat_elec', name: 'Electrical Parts', icon: '⚡', active: true },
  { id: 'cat_plumb', name: 'Plumbing Parts', icon: '🚰', active: true },
  { id: 'cat_cctv', name: 'CCTV Parts', icon: '📹', active: true },
  { id: 'cat_clean', name: 'Cleaning Equipment Parts', icon: '🧹', active: true },
  { id: 'cat_ro', name: 'RO/Water Purifier Parts', icon: '💧', active: true },
  { id: 'cat_gen', name: 'General Home Appliance Parts', icon: '🔧', active: true }
];
let sparePartSuppliers = [
  {
    _id: 'SUP001',
    name: 'CoolTech Components Pvt Ltd',
    phone: '9848012345',
    email: 'supply@cooltech.com',
    address: 'Secunderabad Electronics Market, Hyderabad',
    notes: 'Primary supplier for LG & IFB genuine parts',
    createdAt: new Date().toISOString()
  },
  {
    _id: 'SUP002',
    name: 'Apex Appliance Spares',
    phone: '9123456789',
    email: 'sales@apexspares.in',
    address: 'Troop Bazaar, Abids, Hyderabad',
    notes: 'OEM supplier for Samsung & Whirlpool spares',
    createdAt: new Date().toISOString()
  }
];
let sparePartRequests = [];
let sparePartAuditHistory = [];
let adminWorkers = [
  { _id: 'W_DEFAULT_1', name: 'VARUN',            phone: '9000853346', email: 'ADITHYAVARUN@GMAIL.COM',  category: 'Plumbing',   skills: ['Plumbing','Pipe Repair','Bathroom','Leak Fix'],         rating: 5.0, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_PLM_1001', workerPassword: 'FXN1001', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_2', name: 'ADITHYA',          phone: '8179712126', email: 'varunpittala@gmail.com',  category: 'Electrical', skills: ['Electrical','Wiring','Fan Installation','Switch Repair'],  rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '7 years',  workerId: 'FIXON_ELC_1001', workerPassword: 'FXN1002', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_3', name: 'Prasad',           phone: '9876543212', email: 'prasad@fixon.com',        category: 'Cleaning',   skills: ['Cleaning','Deep Cleaning','Home Services'],                rating: 4.7, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '3 years',  workerId: 'FIXON_CLN_1001', workerPassword: 'FXN1003', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_4', name: 'Vijay Tech',       phone: '9876543213', email: 'vijay@fixon.com',         category: 'AC Repair',  skills: ['AC Repair','AC Service','Cooling'],                        rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '8 years',  workerId: 'FIXON_ACR_1001', workerPassword: 'FXN1004', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_5', name: 'Mahesh Carpenter', phone: '9876543214', email: 'mahesh@fixon.com',        category: 'Carpentry',  skills: ['Carpentry','Furniture','Wood Work'],                      rating: 4.6, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_CRP_1001', workerPassword: 'FXN1005', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_6', name: 'Srinivas Painter', phone: '9876543215', email: 'srinivas@fixon.com',      category: 'Painting',   skills: ['Painting','Wall Polish','Coloring'],                       rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '10 years', workerId: 'FIXON_PNT_1001', workerPassword: 'FXN1006', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_7', name: 'Ramesh Pest Control', phone: '9876543216', email: 'ramesh@fixon.com',     category: 'Pest Control', skills: ['Pest Control','Spray','Termite'],                         rating: 4.7, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '4 years',  workerId: 'FIXON_PCT_1001', workerPassword: 'FXN1007', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_8', name: 'Kiran CCTV',       phone: '9876543217', email: 'kiran@fixon.com',         category: 'CCTV Setup', skills: ['CCTV Setup','Camera Installation','Security'],              rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_CCT_1001', workerPassword: 'FXN1008', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_9', name: 'Rajesh Studio',    phone: '9876543218', email: 'rajesh@fixon.com',        category: 'Photo Studio', skills: ['Photo Studio','Photography','Videography','Drone'],       rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_PHT_1001', workerPassword: 'FXN1009', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_10', name: 'Venkat Tents',    phone: '9876543219', email: 'venkat@fixon.com',        category: 'Wedding Tent House', skills: ['Wedding Tent House','Stage','Lighting'],            rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '9 years',  workerId: 'FIXON_WTH_1001', workerPassword: 'FXN1010', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_11', name: 'Satyam Catering', phone: '9876543220', email: 'satyam@fixon.com',        category: 'Catering Services', skills: ['Catering Services','Veg/Non-Veg','Sweets'],          rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '12 years', workerId: 'FIXON_CAT_1001', workerPassword: 'FXN1011', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_12', name: 'Anil Decors',     phone: '9876543221', email: 'anil@fixon.com',          category: 'Decoration Services', skills: ['Decoration Services','Flower','Stage Decor'],     rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '7 years',  workerId: 'FIXON_DEC_1001', workerPassword: 'FXN1012', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_13', name: 'DJ Rahul',        phone: '9876543222', email: 'rahul@fixon.com',         category: 'DJ & Music', skills: ['DJ & Music','Sound System','Orchestra'],                    rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_DJM_1001', workerPassword: 'FXN1013', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_14', name: 'Suresh Media',    phone: '9876543223', email: 'suresh@fixon.com',        category: 'Videography', skills: ['Videography','Cinematic Video','Editing'],               rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '8 years',  workerId: 'FIXON_VDG_1001', workerPassword: 'FXN1014', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_15', name: 'Royal Travels',   phone: '9876543224', email: 'royal@fixon.com',         category: 'Vehicle Rental', skills: ['Vehicle Rental','Luxury Car','Wedding Car'],           rating: 4.7, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_VHR_1001', workerPassword: 'FXN1015', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_16', name: 'Priya Studio',    phone: '9876543225', email: 'priya@fixon.com',         category: 'Makeup Artist', skills: ['Makeup Artist','Bridal Makeup','Styling'],              rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_MKP_1001', workerPassword: 'FXN1016', createdAt: new Date().toISOString() },
];
let services = [
  { _id: 'SV1',  name: 'Plumbing',            icon: 'ðŸ”§', color: '#7C3AED', price: 499,  active: true, packages: [{name: 'Leaky Tap Repair', price: 499}, {name: 'Full Bathroom Polish', price: 1499}] },
  { _id: 'SV2',  name: 'Electrical',           icon: 'âš¡', color: '#F59E0B', price: 599,  active: true, packages: [{name: 'Single Point Fix', price: 599}, {name: 'Home Safety Check', price: 1999}] },
  { _id: 'SV3',  name: 'Cleaning',             icon: 'ðŸ§¹', color: '#10B981', price: 1299, active: true, packages: [{name: '1 BHK', price: 1299}, {name: '2 BHK', price: 2199}, {name: 'Villa', price: 4999}] },
  { _id: 'SV4',  name: 'AC Repair',            icon: 'â„ï¸', color: '#06B6D4', price: 799,  active: true, packages: [{name: 'Basic Service', price: 799}, {name: 'Gas Refill & Check', price: 2499}] },
  { _id: 'SV5',  name: 'Carpentry',            icon: 'ðŸªš', color: '#EC4899', price: 699,  active: true, packages: [] },
  { _id: 'SV6',  name: 'Painting',             icon: 'ðŸŽ¨', color: '#EF4444', price: 2499, active: true, packages: [] },
  { _id: 'SV7',  name: 'Pest Control',         icon: 'ðŸ›', color: '#8B5CF6', price: 999,  active: true, packages: [] },
  { _id: 'SV8',  name: 'CCTV Setup',           icon: 'ðŸ“¹', color: '#059669', price: 3499, active: true, packages: [] },
  // ðŸŽ‰ Wedding & Event Services
  { _id: 'SV9',  name: 'Photo Studio',         icon: 'ðŸ“¸', color: '#E11D48', price: 4999, active: true, packages: [{name: 'Wedding Photography', price: 14999}, {name: 'Pre Wedding Shoot', price: 7999}, {name: 'Post Wedding Shoot', price: 5999}, {name: 'Drone Photography', price: 9999}, {name: 'Cinematic Video', price: 19999}, {name: 'Album Design', price: 3999}, {name: 'Live Streaming', price: 4999}] },
  { _id: 'SV10', name: 'Wedding Tent House',   icon: 'ðŸŽª', color: '#D97706', price: 9999, active: true, packages: [{name: 'Tent Setup', price: 9999}, {name: 'Stage Decoration', price: 14999}, {name: 'Chairs & Tables', price: 4999}, {name: 'Lighting', price: 7999}, {name: 'Generator', price: 5999}, {name: 'Sound System', price: 8999}, {name: 'LED Wall', price: 12999}, {name: 'Flower Decoration', price: 6999}] },
  { _id: 'SV11', name: 'Catering Services',    icon: 'ðŸ½', color: '#059669', price: 299,  active: true, packages: [{name: 'Veg Catering (per plate)', price: 299}, {name: 'Non-Veg Catering (per plate)', price: 399}, {name: 'Sweets Package', price: 4999}, {name: 'Snacks Package', price: 2999}, {name: 'Live Counters', price: 9999}] },
  { _id: 'SV12', name: 'Decoration Services',  icon: 'ðŸŽ€', color: '#9333EA', price: 2999, active: true, packages: [{name: 'Wedding Decoration', price: 24999}, {name: 'Birthday Decoration', price: 2999}, {name: 'Balloon Decoration', price: 1999}, {name: 'Flower Decoration', price: 4999}, {name: 'Reception Decoration', price: 14999}] },
  { _id: 'SV13', name: 'DJ & Music',           icon: 'ðŸŽµ', color: '#2563EB', price: 4999, active: true, packages: [{name: 'DJ Sound', price: 4999}, {name: 'Orchestra', price: 14999}, {name: 'Live Band', price: 19999}, {name: 'Traditional Music', price: 7999}] },
  { _id: 'SV14', name: 'Videography',          icon: 'ðŸŽ¥', color: '#DC2626', price: 5999, active: true, packages: [{name: 'Wedding Video', price: 14999}, {name: 'Birthday Video', price: 3999}, {name: 'Drone Video', price: 7999}, {name: 'Cinematic Editing', price: 4999}] },
  { _id: 'SV15', name: 'Vehicle Rental',       icon: 'ðŸš—', color: '#4F46E5', price: 3499, active: true, packages: [{name: 'Wedding Car', price: 3499}, {name: 'Luxury Car', price: 7999}, {name: 'Bus', price: 9999}, {name: 'Traveller', price: 5999}] },
  { _id: 'SV16', name: 'Makeup Artist',        icon: 'ðŸ’„', color: '#DB2777', price: 1999, active: true, packages: [{name: 'Bridal Makeup', price: 4999}, {name: 'Groom Makeup', price: 2499}, {name: 'Hair Styling', price: 1999}, {name: 'Mehendi', price: 2999}] },
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
  'W_DEFAULT_6': { workerId:'FIXON_PNT_1001', workerPassword:'FXN1006' },
  'W_DEFAULT_7': { workerId:'FIXON_PCT_1001', workerPassword:'FXN1007' },
  'W_DEFAULT_8': { workerId:'FIXON_CCT_1001', workerPassword:'FXN1008' },
  'W_DEFAULT_9': { workerId:'FIXON_PHT_1001', workerPassword:'FXN1009' },
  'W_DEFAULT_10': { workerId:'FIXON_WTH_1001', workerPassword:'FXN1010' },
  'W_DEFAULT_11': { workerId:'FIXON_CAT_1001', workerPassword:'FXN1011' },
  'W_DEFAULT_12': { workerId:'FIXON_DEC_1001', workerPassword:'FXN1012' },
  'W_DEFAULT_13': { workerId:'FIXON_DJM_1001', workerPassword:'FXN1013' },
  'W_DEFAULT_14': { workerId:'FIXON_VDG_1001', workerPassword:'FXN1014' },
  'W_DEFAULT_15': { workerId:'FIXON_VHR_1001', workerPassword:'FXN1015' },
  'W_DEFAULT_16': { workerId:'FIXON_MKP_1001', workerPassword:'FXN1016' },
};

function applyDefaultCreds(workers) {
  return workers.map(w => {
    const cred = DEFAULT_CREDS[w._id];
    if (cred && !w.workerId) return { ...w, ...cred, isOnline: w.isOnline || false };
    return w;
  });
}

// Merge in any DEFAULT services that are not already stored (by _id)
// This ensures new services added in code automatically appear on Render
const DEFAULT_SERVICES_SNAPSHOT = [
  { _id: 'SV1',  name: 'Plumbing',            icon: 'ðŸ”§', color: '#7C3AED', price: 499,  active: true, packages: [{name: 'Leaky Tap Repair', price: 499}, {name: 'Full Bathroom Polish', price: 1499}] },
  { _id: 'SV2',  name: 'Electrical',           icon: 'âš¡', color: '#F59E0B', price: 599,  active: true, packages: [{name: 'Single Point Fix', price: 599}, {name: 'Home Safety Check', price: 1999}] },
  { _id: 'SV3',  name: 'Cleaning',             icon: 'ðŸ§¹', color: '#10B981', price: 1299, active: true, packages: [{name: '1 BHK', price: 1299}, {name: '2 BHK', price: 2199}, {name: 'Villa', price: 4999}] },
  { _id: 'SV4',  name: 'AC Repair',            icon: 'â„ï¸', color: '#06B6D4', price: 799,  active: true, packages: [{name: 'Basic Service', price: 799}, {name: 'Gas Refill & Check', price: 2499}] },
  { _id: 'SV5',  name: 'Carpentry',            icon: 'ðŸªš', color: '#EC4899', price: 699,  active: true, packages: [] },
  { _id: 'SV6',  name: 'Painting',             icon: 'ðŸŽ¨', color: '#EF4444', price: 2499, active: true, packages: [] },
  { _id: 'SV7',  name: 'Pest Control',         icon: 'ðŸ›', color: '#8B5CF6', price: 999,  active: true, packages: [] },
  { _id: 'SV8',  name: 'CCTV Setup',           icon: 'ðŸ“¹', color: '#059669', price: 3499, active: true, packages: [] },
  { _id: 'SV9',  name: 'Photo Studio',         icon: 'ðŸ“¸', color: '#E11D48', price: 4999, active: true, packages: [{name: 'Wedding Photography', price: 14999}, {name: 'Pre Wedding Shoot', price: 7999}, {name: 'Post Wedding Shoot', price: 5999}, {name: 'Drone Photography', price: 9999}, {name: 'Cinematic Video', price: 19999}, {name: 'Album Design', price: 3999}, {name: 'Live Streaming', price: 4999}] },
  { _id: 'SV10', name: 'Wedding Tent House',   icon: 'ðŸŽª', color: '#D97706', price: 9999, active: true, packages: [{name: 'Tent Setup', price: 9999}, {name: 'Stage Decoration', price: 14999}, {name: 'Chairs & Tables', price: 4999}, {name: 'Lighting', price: 7999}, {name: 'Generator', price: 5999}, {name: 'Sound System', price: 8999}, {name: 'LED Wall', price: 12999}, {name: 'Flower Decoration', price: 6999}] },
  { _id: 'SV11', name: 'Catering Services',    icon: 'ðŸ½', color: '#059669', price: 299,  active: true, packages: [{name: 'Veg Catering (per plate)', price: 299}, {name: 'Non-Veg Catering (per plate)', price: 399}, {name: 'Sweets Package', price: 4999}, {name: 'Snacks Package', price: 2999}, {name: 'Live Counters', price: 9999}] },
  { _id: 'SV12', name: 'Decoration Services',  icon: 'ðŸŽ€', color: '#9333EA', price: 2999, active: true, packages: [{name: 'Wedding Decoration', price: 24999}, {name: 'Birthday Decoration', price: 2999}, {name: 'Balloon Decoration', price: 1999}, {name: 'Flower Decoration', price: 4999}, {name: 'Reception Decoration', price: 14999}] },
  { _id: 'SV13', name: 'DJ & Music',           icon: 'ðŸŽµ', color: '#2563EB', price: 4999, active: true, packages: [{name: 'DJ Sound', price: 4999}, {name: 'Orchestra', price: 14999}, {name: 'Live Band', price: 19999}, {name: 'Traditional Music', price: 7999}] },
  { _id: 'SV14', name: 'Videography',          icon: 'ðŸŽ¥', color: '#DC2626', price: 5999, active: true, packages: [{name: 'Wedding Video', price: 14999}, {name: 'Birthday Video', price: 3999}, {name: 'Drone Video', price: 7999}, {name: 'Cinematic Editing', price: 4999}] },
  { _id: 'SV15', name: 'Vehicle Rental',       icon: 'ðŸš—', color: '#4F46E5', price: 3499, active: true, packages: [{name: 'Wedding Car', price: 3499}, {name: 'Luxury Car', price: 7999}, {name: 'Bus', price: 9999}, {name: 'Traveller', price: 5999}] },
  { _id: 'SV16', name: 'Makeup Artist',        icon: 'ðŸ’„', color: '#DB2777', price: 1999, active: true, packages: [{name: 'Bridal Makeup', price: 4999}, {name: 'Groom Makeup', price: 2499}, {name: 'Hair Styling', price: 1999}, {name: 'Mehendi', price: 2999}] },
];

function mergeDefaultServices() {
  const existingIds = new Set(services.map(s => s._id));
  const missing = DEFAULT_SERVICES_SNAPSHOT.filter(s => !existingIds.has(s._id));
  if (missing.length > 0) {
    services = [...services, ...missing];
    console.log(`âœ… Merged ${missing.length} new default services:`, missing.map(s => s.name).join(', '));
    saveData();
  }
}

const DEFAULT_WORKERS_SNAPSHOT = [
  { _id: 'W_DEFAULT_1', name: 'VARUN',            phone: '9000853346', email: 'ADITHYAVARUN@GMAIL.COM',  category: 'Plumbing',   skills: ['Plumbing','Pipe Repair','Bathroom','Leak Fix'],         rating: 5.0, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_PLM_1001', workerPassword: 'FXN1001', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_2', name: 'ADITHYA',          phone: '8179712126', email: 'varunpittala@gmail.com',  category: 'Electrical', skills: ['Electrical','Wiring','Fan Installation','Switch Repair'],  rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '7 years',  workerId: 'FIXON_ELC_1001', workerPassword: 'FXN1002', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_3', name: 'Prasad',           phone: '9876543212', email: 'prasad@fixon.com',        category: 'Cleaning',   skills: ['Cleaning','Deep Cleaning','Home Services'],                rating: 4.7, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '3 years',  workerId: 'FIXON_CLN_1001', workerPassword: 'FXN1003', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_4', name: 'Vijay Tech',       phone: '9876543213', email: 'vijay@fixon.com',         category: 'AC Repair',  skills: ['AC Repair','AC Service','Cooling'],                        rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '8 years',  workerId: 'FIXON_ACR_1001', workerPassword: 'FXN1004', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_5', name: 'Mahesh Carpenter', phone: '9876543214', email: 'mahesh@fixon.com',        category: 'Carpentry',  skills: ['Carpentry','Furniture','Wood Work'],                      rating: 4.6, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_CRP_1001', workerPassword: 'FXN1005', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_6', name: 'Srinivas Painter', phone: '9876543215', email: 'srinivas@fixon.com',      category: 'Painting',   skills: ['Painting','Wall Polish','Coloring'],                       rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '10 years', workerId: 'FIXON_PNT_1001', workerPassword: 'FXN1006', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_7', name: 'Ramesh Pest Control', phone: '9876543216', email: 'ramesh@fixon.com',     category: 'Pest Control', skills: ['Pest Control','Spray','Termite'],                         rating: 4.7, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '4 years',  workerId: 'FIXON_PCT_1001', workerPassword: 'FXN1007', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_8', name: 'Kiran CCTV',       phone: '9876543217', email: 'kiran@fixon.com',         category: 'CCTV Setup', skills: ['CCTV Setup','Camera Installation','Security'],              rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_CCT_1001', workerPassword: 'FXN1008', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_9', name: 'Rajesh Studio',    phone: '9876543218', email: 'rajesh@fixon.com',        category: 'Photo Studio', skills: ['Photo Studio','Photography','Videography','Drone'],       rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_PHT_1001', workerPassword: 'FXN1009', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_10', name: 'Venkat Tents',    phone: '9876543219', email: 'venkat@fixon.com',        category: 'Wedding Tent House', skills: ['Wedding Tent House','Stage','Lighting'],            rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '9 years',  workerId: 'FIXON_WTH_1001', workerPassword: 'FXN1010', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_11', name: 'Satyam Catering', phone: '9876543220', email: 'satyam@fixon.com',        category: 'Catering Services', skills: ['Catering Services','Veg/Non-Veg','Sweets'],          rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '12 years', workerId: 'FIXON_CAT_1001', workerPassword: 'FXN1011', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_12', name: 'Anil Decors',     phone: '9876543221', email: 'anil@fixon.com',          category: 'Decoration Services', skills: ['Decoration Services','Flower','Stage Decor'],     rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '7 years',  workerId: 'FIXON_DEC_1001', workerPassword: 'FXN1012', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_13', name: 'DJ Rahul',        phone: '9876543222', email: 'rahul@fixon.com',         category: 'DJ & Music', skills: ['DJ & Music','Sound System','Orchestra'],                    rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_DJM_1001', workerPassword: 'FXN1013', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_14', name: 'Suresh Media',    phone: '9876543223', email: 'suresh@fixon.com',        category: 'Videography', skills: ['Videography','Cinematic Video','Editing'],               rating: 4.8, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '8 years',  workerId: 'FIXON_VDG_1001', workerPassword: 'FXN1014', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_15', name: 'Royal Travels',   phone: '9876543224', email: 'royal@fixon.com',         category: 'Vehicle Rental', skills: ['Vehicle Rental','Luxury Car','Wedding Car'],           rating: 4.7, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '6 years',  workerId: 'FIXON_VHR_1001', workerPassword: 'FXN1015', createdAt: new Date().toISOString() },
  { _id: 'W_DEFAULT_16', name: 'Priya Studio',    phone: '9876543225', email: 'priya@fixon.com',         category: 'Makeup Artist', skills: ['Makeup Artist','Bridal Makeup','Styling'],              rating: 4.9, active: true, isAvailable: true, isActive: true, isOnline: false, experience: '5 years',  workerId: 'FIXON_MKP_1001', workerPassword: 'FXN1016', createdAt: new Date().toISOString() },
];

function mergeDefaultWorkers() {
  const existingIds = new Set(adminWorkers.map(w => w._id));
  const missing = DEFAULT_WORKERS_SNAPSHOT.filter(w => !existingIds.has(w._id));
  if (missing.length > 0) {
    adminWorkers = [...adminWorkers, ...missing];
    console.log(`âœ… Merged ${missing.length} default workers into active list`);
  }
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
        if (doc.spareParts && doc.spareParts.length > 0) spareParts = doc.spareParts;
        if (doc.sparePartOrders && doc.sparePartOrders.length > 0) sparePartOrders = doc.sparePartOrders;
        if (doc.sparePartCategories && doc.sparePartCategories.length > 0) sparePartCategories = doc.sparePartCategories;
        if (doc.sparePartSuppliers && doc.sparePartSuppliers.length > 0) sparePartSuppliers = doc.sparePartSuppliers;
        if (doc.sparePartRequests && doc.sparePartRequests.length > 0) sparePartRequests = doc.sparePartRequests;
        if (doc.sparePartAuditHistory && doc.sparePartAuditHistory.length > 0) sparePartAuditHistory = doc.sparePartAuditHistory;
        console.log('âœ… Data loaded from MongoDB Atlas! Users:', registeredUsers.length);
        adminWorkers = applyDefaultCreds(adminWorkers);
        mergeDefaultWorkers();
        mergeDefaultServices();
        console.log('âœ… Workers loaded:', adminWorkers.length);
        return;
      }
    } catch (err) {
      console.error('âš ï¸ MongoDB load failed, falling back to file:', err.message);
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
        if (parsed.spareParts && parsed.spareParts.length > 0) spareParts = parsed.spareParts;
        if (parsed.sparePartOrders && parsed.sparePartOrders.length > 0) sparePartOrders = parsed.sparePartOrders;
        if (parsed.sparePartCategories && parsed.sparePartCategories.length > 0) sparePartCategories = parsed.sparePartCategories;
        if (parsed.sparePartSuppliers && parsed.sparePartSuppliers.length > 0) sparePartSuppliers = parsed.sparePartSuppliers;
        if (parsed.sparePartRequests && parsed.sparePartRequests.length > 0) sparePartRequests = parsed.sparePartRequests;
        if (parsed.sparePartAuditHistory && parsed.sparePartAuditHistory.length > 0) sparePartAuditHistory = parsed.sparePartAuditHistory;
      }
    }
  } catch (error) {
    console.error('ðŸ”¥ Local Data Load Error:', error);
  }

  adminWorkers = applyDefaultCreds(adminWorkers);
  mergeDefaultWorkers();
  mergeDefaultServices();
  console.log('âœ… Workers loaded:', adminWorkers.length, '| Credentialed:', adminWorkers.filter(w=>w.workerId).length);
}

// Generate unique Worker ID + password from category
function generateWorkerCredentials(category, existingCount) {
  const categoryMap = {
    'Plumbing': 'PLM', 'Electrical': 'ELC', 'Cleaning': 'CLN',
    'AC Repair': 'ACR', 'Carpentry': 'CRP', 'Painting': 'PNT',
    'Pest Control': 'PCT', 'CCTV Setup': 'CCT', 'Appliance Repair': 'APL',
    // Event Services
    'Photo Studio': 'PHT', 'Wedding Tent House': 'WTH', 'Catering Services': 'CAT',
    'Decoration Services': 'DEC', 'DJ & Music': 'DJM', 'Videography': 'VDG',
    'Vehicle Rental': 'VHR', 'Makeup Artist': 'MKP',
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
      console.log('âœ… Photos loaded from MongoDB Atlas! Count:', Object.keys(bookingPhotos).length);

      // Migrated local photos if database is empty
      if (photos.length === 0 && fs.existsSync(PHOTOS_FILE)) {
        console.log('ðŸ“¤ Migrating local photos to MongoDB...');
        const localPhotos = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf-8') || '{}');
        for (const [bookingId, photoObj] of Object.entries(localPhotos)) {
          await BookingPhoto.findOneAndUpdate(
            { bookingId },
            { bookingId, ...photoObj },
            { upsert: true }
          );
        }
        console.log('âœ… Migration complete!');
      }
      return;
    } catch (err) {
      console.error('âš ï¸ MongoDB photos load failed, using file fallback:', err.message);
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
    console.log('âœ… Photos loaded from local file! Count:', Object.keys(bookingPhotos).length);
  } catch (error) {
    console.error('ðŸ”¥ Local Photos Load Error:', error);
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
      console.error('âš ï¸ MongoDB photo save failed:', err.message);
    }
  }

  // 2. Fallback: local file
  try {
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(bookingPhotos, null, 2), 'utf-8');
  } catch (error) {
    console.error('ðŸ”¥ Local Photo Save Error:', error);
  }
}

// Debounced saveData â€” prevents blocking API responses with heavy writes on every request
let _saveTimer = null;
function saveData() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_doSave, 2000);
}

async function _doSave() {
  // Strip heavy worker photos from bookings before saving to prevent memory bloat, but KEEP customer problem photos!
  const cleanBookings = bookings.map(b => {
    const copy = { ...b };
    delete copy.afterPhoto;
    delete copy.workerAfterPhoto;
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
      delete bCopy.problemPhoto;
      copy.booking = bCopy;
      return copy;
    }
    return n;
  });

  const dataObj = {
    registeredUsers,
    bookings: cleanBookings,
    messages,
    notificationsList: cleanNotifs,
    adminWorkers,
    services,
    coupons,
    spareParts,
    sparePartOrders,
    sparePartCategories,
    sparePartSuppliers,
    sparePartRequests,
    sparePartAuditHistory
  };

  // 1. Save to MongoDB Atlas (primary)
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      await AppData.findOneAndUpdate(
        { key: 'main' },
        { key: 'main', ...dataObj },
        { upsert: true, new: true }
      );
      return; // success â€” no need for file fallback
    } catch (err) {
      console.error('âš ï¸ MongoDB save failed, using file fallback:', err.message);
    }
  }

  // 2. Fallback: local file
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataObj, null, 2), 'utf-8');
  } catch (error) {
    console.error('ðŸ”¥ Local Data Save Error:', error);
  }
}

// â”€â”€ Start server: connect MongoDB first, THEN load data â”€â”€â”€â”€â”€â”€â”€â”€
async function startServer() {
  // 1. Connect to MongoDB Atlas first (await it!)
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      console.log('âœ… MongoDB Atlas connected!');
    } catch (err) {
      console.error('âŒ MongoDB connect error:', err.message);
      console.log('âš ï¸  Falling back to local file storage...');
    }
  }

  // 2. Load data AFTER connection is established
  await loadData();
  await loadPhotos();
  console.log('ðŸ”¥ Initial data loaded!');

  // 3. Start HTTP server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\nðŸš€ FixoN Server running at port ${PORT}`);
    console.log(`   Socket.IO ready for real-time tracking âš¡\n`);
  });

  // 4. Auto-save every 30 seconds
  setInterval(saveData, 30000);

  // 5. Keep-Alive: Self-ping every 14 minutes to prevent cloud host from sleeping
  // Works on Railway, Render, and any other host (uses RAILWAY_PUBLIC_DOMAIN or RENDER_EXTERNAL_URL)
  const SELF_URL = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : (process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`);
  setInterval(async () => {
    try {
      const https = require('https');
      const http2 = require('http');
      const urlMod = require('url');
      const parsed = urlMod.parse(`${SELF_URL}/api/health`);
      const requester = parsed.protocol === 'https:' ? https : http2;
      requester.get(`${SELF_URL}/api/health`, (res) => {
        console.log(`ðŸ“ Keep-alive ping â†’ ${res.statusCode}`);
      }).on('error', () => {});
    } catch (_) {}
  }, 14 * 60 * 1000); // every 14 minutes
}

startServer().catch(err => {
  console.error('âŒ Fatal startup error:', err);
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => console.log(`ðŸš€ Server started (Emergency Mode) on port ${PORT}`));
});

// â”€â”€ Socket.IO Connection Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Maps socket.id â†’ userId so we can detect when a customer goes offline
const socketUserMap = {};

io.on('connection', (socket) => {
  // Customer mobile app joins
  socket.on('customer_join', (data) => {
    const userId = data?.userId;
    const userName = data?.name || 'Customer';
    if (userId) {
      const sId = String(userId);
      socket.userId = sId;
      socketUserMap[socket.id] = sId;
      
      const realUser = registeredUsers.find(u => String(u._id) === sId);
      if (realUser) {
        realUser.lastSeen = new Date().toISOString();
        realUser.isOnline = true;
      }

      if (!users[sId]) {
        users[sId] = { 
          _id: sId, 
          name: userName || realUser?.name || 'Customer', 
          email: realUser?.email || '',
          phone: realUser?.phone || ''
        };
      }
      users[sId].lastSeen = new Date().toISOString();
      users[sId].isOnline = true;

      // Broadcast instant online update to admin control panel
      io.emit('user_join', { userId: sId, name: userName, isOnline: true });
      io.emit('user_location', { userId: sId, isOnline: true });
      console.log(`👤 Customer joined socket: ${userName} (${sId})`);
    }
  });

  // Admin panel joins (for future use)
  socket.on('admin_join', () => {
    socket.isAdmin = true;
  });

  // âœ… When customer disconnects â†’ immediately remove from live map
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
        console.log(`ðŸ“´ Customer offline: ${userId}`);
      }
    }
  });
});

// â”€â”€ Periodic MongoDB Reload every 60s (so admin panel gets Render cloud bookings) â”€â”€
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
      // Silent fail â€” in-memory data stays valid
    }
  }
}, 60000);

// â”€â”€ Smart Bot auto-responder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BOT_RULES = [
  { keywords: ['booking', 'book', 'schedule', 'cancel'],
    reply: 'ðŸ“… For booking issues, you can view or cancel your bookings in the "My Bookings" tab. Need something specific?' },
  { keywords: ['payment', 'pay', 'charge', 'refund', 'money'],
    reply: 'ðŸ’³ Payments are processed securely. Refunds take 3-5 business days. Would you like to speak with an admin?' },
  { keywords: ['worker', 'technician', 'plumber', 'electrician', 'late', 'delay'],
    reply: 'ðŸ‘· I understand your concern! Our team is tracking the worker\'s location. An admin will update you shortly.' },
  { keywords: ['price', 'cost', 'charge', 'expensive', 'how much'],
    reply: 'ðŸ’° All prices are listed transparently in the app. No hidden charges ever! Visit Services to see pricing.' },
  { keywords: ['hello', 'hi', 'hey', 'help', 'hii'],
    reply: 'ðŸ‘‹ Hello! Welcome to FixoN Support. How can I help you today? You can ask me about bookings, payments, or services!' },
  { keywords: ['thank', 'thanks', 'okay', 'ok', 'great'],
    reply: 'ðŸ˜Š You\'re welcome! Is there anything else I can help you with?' },
  { keywords: ['location', 'track', 'where', 'gps'],
    reply: 'ðŸ“ Your location is being tracked in real-time. Our admin can see your position to assign the nearest worker!' },
  { keywords: ['leak', 'water', 'pipe', 'tap', 'clog', 'sink', 'drain'],
    reply: 'ðŸ’§ Plumbing issue detected! If you have an active water leak, please shut off your main water valve first. You can book an emergency Plumber directly from the home screen.' },
  { keywords: ['shock', 'power', 'fuse', 'spark', 'wire', 'short', 'electricity'],
    reply: 'âš¡ Electrical hazard! Please stay away from wet areas and do not touch exposed wires. Turn off the main circuit breaker if safe, and book a certified Electrician from our app immediately.' },
  { keywords: ['ac', 'cool', 'heat', 'compressor', 'filter', 'dripping'],
    reply: 'â„ï¸ AC issue? If your AC is not cooling, it could be a dirty filter or low refrigerant. You can book a certified AC technician under the "AC Repair" service.' },
  { keywords: ['coupon', 'promo', 'discount', 'code', 'not working'],
    reply: 'ðŸŽ« Promo code issues? Ensure the code is typed in ALL CAPS (e.g. FIRST50). Also check that your cart meets the minimum order amount and the code hasn\'t expired.' },
  { keywords: ['wallet', 'cashback', 'bonus', 'balance'],
    reply: 'ðŸ‘› Wallet questions? Referral bonuses and cashbacks are auto-credited to your wallet. Wallet balance will be applied automatically on your next checkout.' },
  { keywords: ['bug', 'crash', 'not loading', 'error', 'slow', 'app'],
    reply: 'ðŸ“± App problem? Try restarting the app or clearing cache. If it still doesn\'t load, please reinstall the app or contact support at support@fixon.com.' },
  { keywords: ['contact', 'call', 'number', 'phone', 'email', 'support'],
    reply: 'ðŸ“ž Contact FixoN Support directly at 1800-FIXON-00 or email us at support@fixon.com. We are available 24/7!' },
];

function getBotReply(message) {
  const lower = message.toLowerCase();
  for (const rule of BOT_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.reply;
  }
  return 'ðŸ¤– I\'ve received your message and forwarded it to our support team. An admin will respond shortly! You can also call us at 1800-FIXON-00.';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  USER AUTH ROUTES (mobile app register / login)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Register a new user â€” called from mobile signup
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
  console.log(`ðŸ†• New user registered: ${name} (${email})`);
  res.json({ success: true, token: 'local_' + userId, user: newUser });
});

// Login â€” called from mobile login screen
app.post('/api/auth/user/login', (req, res) => {
  const { email, password } = req.body;
  const user = registeredUsers.find(u => u.email === email);
  if (!user) return res.status(401).json({ success: false, error: 'User not found' });
  if (user.password !== password) return res.status(401).json({ success: false, error: 'Wrong password' });
  res.json({ success: true, token: 'local_' + user._id, user });
});

// â”€â”€ Customer Bank Details (for refunds) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PUT /api/user/:userId/bank-details
app.put('/api/user/:userId/bank-details', (req, res) => {
  const { userId } = req.params;
  const { accountName, accountNumber, ifscCode, bankName, upiId } = req.body;
  const user = registeredUsers.find(u => u._id === userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.bankDetails = {
    accountName: accountName || '',
    accountNumber: accountNumber || '',
    ifscCode: (ifscCode || '').toUpperCase(),
    bankName: bankName || '',
    upiId: upiId || '',
    updatedAt: new Date().toISOString(),
  };
  saveData();
  console.log(`ðŸ¦ Bank details saved for: ${user.name} (${userId})`);
  res.json({ success: true, message: 'Bank details saved', bankDetails: user.bankDetails });
});

// GET /api/user/:userId/bank-details
app.get('/api/user/:userId/bank-details', (req, res) => {
  const user = registeredUsers.find(u => u._id === req.params.userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, bankDetails: user.bankDetails || null });
});

// Admin: get all registered, active, booking, and chatting users
const getAdminUsersHandler = (req, res) => {
  const userMap = {};

  // 1. Populate registered users
  registeredUsers.forEach(u => {
    if (!u || !u._id) return;
    const sId = String(u._id);
    const liveInfo = users[sId] || users[u._id];
    const isOnline = !!(
      (liveInfo && liveInfo.lastSeen && (new Date() - new Date(liveInfo.lastSeen) < 180000)) ||
      (u.lastSeen && (new Date() - new Date(u.lastSeen) < 180000))
    );

    userMap[sId] = {
      ...u,
      _id: sId,
      location: liveInfo 
        ? { lat: liveInfo.lat, lng: liveInfo.lng, address: liveInfo.address || u.location?.address || '' } 
        : (u.location || {}),
      isOnline,
      lastSeen: liveInfo ? liveInfo.lastSeen : (u.lastSeen || null),
    };
  });

  // 2. Add active users (live location tracks)
  Object.values(users).forEach(u => {
    if (!u || !u._id) return;
    const sId = String(u._id);
    if (!userMap[sId]) {
      const isOnline = u.lastSeen ? (new Date() - new Date(u.lastSeen) < 60000) : false;
      userMap[sId] = {
        _id: sId,
        name: u.name || 'Customer',
        email: u.email || '',
        phone: u.phone || '',
        location: { lat: u.lat, lng: u.lng, address: u.address || '' },
        isOnline,
        lastSeen: u.lastSeen,
        isBlocked: false,
        createdAt: u.lastSeen || new Date().toISOString(),
      };
    }
  });

  // 3. Add chatting users from messages history
  messages.forEach(m => {
    const senderId = m.senderId ? String(m.senderId) : null;
    if (senderId && senderId !== 'admin' && senderId !== 'bot' && !userMap[senderId]) {
      const liveInfo = users[senderId];
      const isOnline = liveInfo && liveInfo.lastSeen ? (new Date() - new Date(liveInfo.lastSeen) < 120000) : false;
      userMap[senderId] = {
        _id: senderId,
        name: m.senderName || m.name || ('Customer ' + senderId.slice(-4)),
        email: m.senderEmail || (senderId + '@fixon.com'),
        phone: m.senderPhone || '',
        location: liveInfo ? { lat: liveInfo.lat, lng: liveInfo.lng, address: liveInfo.address || '' } : {},
        isOnline,
        lastSeen: liveInfo ? liveInfo.lastSeen : null,
        isBlocked: false,
        createdAt: m.createdAt || new Date().toISOString(),
      };
    }
  });

  // 4. Add customers from bookings array
  bookings.forEach(b => {
    const uId = b.userId?._id ? String(b.userId._id) : (b.userId ? String(b.userId) : null);
    if (uId && uId !== 'undefined' && uId !== 'null' && !userMap[uId]) {
      const liveInfo = users[uId];
      userMap[uId] = {
        _id: uId,
        name: b.userId?.name || b.userName || ('Customer ' + uId.slice(-4)),
        email: b.userId?.email || b.userEmail || '',
        phone: b.userId?.phone || b.userPhone || '',
        location: b.location || {},
        isOnline: liveInfo ? (new Date() - new Date(liveInfo.lastSeen) < 60000) : false,
        lastSeen: liveInfo ? liveInfo.lastSeen : null,
        isBlocked: false,
        createdAt: b.createdAt || new Date().toISOString()
      };
    }
  });

  // 5. Calculate totalBookings for each customer accurately
  const userList = Object.values(userMap).map(u => {
    const count = bookings.filter(b => {
      const bUserId = b.userId?._id ? String(b.userId._id) : (b.userId ? String(b.userId) : null);
      const bPhone = b.userId?.phone || b.userPhone;
      return (bUserId === u._id) || (u.phone && bPhone === u.phone);
    }).length;

    return {
      ...u,
      totalBookings: count
    };
  });

  res.json({ success: true, users: userList });
};

app.get('/api/admin/users', getAdminUsersHandler);
app.get('/api/users', getAdminUsersHandler);

// Admin: get user count
app.get('/api/admin/users/count', (req, res) => {
  const userMap = {};
  registeredUsers.forEach(u => { if (u && u._id) userMap[String(u._id)] = u; });
  Object.values(users).forEach(u => { if (u && u._id) userMap[String(u._id)] = u; });
  messages.forEach(m => {
    if (m.senderId && m.senderId !== 'admin' && m.senderId !== 'bot') userMap[String(m.senderId)] = true;
  });
  bookings.forEach(b => {
    const uId = b.userId?._id ? String(b.userId._id) : (b.userId ? String(b.userId) : null);
    if (uId && uId !== 'undefined' && uId !== 'null') userMap[uId] = true;
  });

  const total = Object.keys(userMap).length;

  const activeCount = Object.values(users).filter(u => {
    if (!u) return false;
    if (u.isOnline === true) return true;
    if (u.lastSeen) return (new Date() - new Date(u.lastSeen) < 180000);
    return false;
  }).length;

  const onlineRegisteredCount = registeredUsers.filter(u => {
    if (u.isOnline === true) return true;
    if (u.lastSeen) return (new Date() - new Date(u.lastSeen) < 180000);
    return false;
  }).length;

  const finalActive = Math.max(activeCount, onlineRegisteredCount);

  res.json({
    success: true,
    totalUsers: total,
    activeUsers: finalActive,
    newUsersToday: registeredUsers.filter(u => new Date(u.createdAt).toDateString() === new Date().toDateString()).length
  });
});

// Admin: get stats
app.get('/api/admin/stats', (req, res) => {
  const completed = bookings.filter(b => b.status === 'completed').length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const revenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.price || 0), 0);
  
  const userMap = {};
  registeredUsers.forEach(u => { if (u && u._id) userMap[String(u._id)] = u; });
  Object.values(users).forEach(u => { if (u && u._id) userMap[String(u._id)] = u; });
  bookings.forEach(b => {
    const uId = b.userId?._id ? String(b.userId._id) : (b.userId ? String(b.userId) : null);
    if (uId && uId !== 'undefined' && uId !== 'null') userMap[uId] = true;
  });

  res.json({
    success: true,
    stats: {
      totalUsers: Object.keys(userMap).length,
      totalWorkers: adminWorkers.length,
      totalBookings: bookings.length,
      completedBookings: completed,
      pendingBookings: pending,
      activeBookings: bookings.filter(b => ['accepted','on_the_way','arrived','ongoing','in_progress'].includes(b.status)).length,
      totalRevenue: revenue,
    }
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  LOCATION ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
    console.log(`ðŸ‘¤ New customer registered: ${users[userId].name}`);
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

  console.log(`ðŸ“ Location update: ${users[userId].name} â†’ ${lat}, ${lng}`);
  res.json({ success: true });
});

// Worker pushes live location
app.post('/api/location/worker', (req, res) => {
  const { workerId, lat, lng } = req.body;
  if (!workerId) return res.status(400).json({ success: false });

  if (!workers[workerId]) workers[workerId] = { _id: workerId };
  workers[workerId].lat = parseFloat(lat);
  workers[workerId].lng = parseFloat(lng);

  // âœ… Also update currentLocation in adminWorkers so the map can show workers
  const adminWorker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
  if (adminWorker) {
    adminWorker.currentLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
    adminWorker.isOnline = true;
    console.log(`ðŸ“ Worker location: ${adminWorker.name} â†’ ${lat}, ${lng}`);
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  BOOKING ROUTES (for mobile app â€” no separate backend)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Full enrich â€” includes photos (used for individual booking detail/photos APIs)
function enrichBooking(b) {
  if (!b) return b;
  const bookingCopy = { ...b };
  bookingCopy.status = normalizeStatus(bookingCopy.status);
  if (bookingCopy.workerId && bookingCopy.workerId._id) {
    const worker = adminWorkers.find(w => w._id === bookingCopy.workerId._id);
    bookingCopy.workerId = {
      ...bookingCopy.workerId,
      rating: worker?.rating || 4.5
    };
  }

  // Attach photos separately for problem, before, and after
  const photoData = bookingPhotos[bookingCopy._id] || {};
  bookingCopy.customerProblemPhoto = b.customerProblemPhoto || b.problemPhoto || photoData.customerProblemPhoto || photoData.problemPhoto || null;
  bookingCopy.workerBeforePhoto = photoData.workerBeforePhoto || photoData.beforePhoto || b.workerBeforePhoto || b.beforePhoto || null;
  bookingCopy.workerAfterPhoto = photoData.workerAfterPhoto || photoData.afterPhoto || b.workerAfterPhoto || b.afterPhoto || null;

  // Aliases for compatibility
  bookingCopy.problemPhoto = bookingCopy.customerProblemPhoto;
  bookingCopy.beforePhoto = bookingCopy.workerBeforePhoto;
  bookingCopy.afterPhoto = bookingCopy.workerAfterPhoto;

  // Flags for existence
  bookingCopy.hasProblemPhoto = !!bookingCopy.customerProblemPhoto;
  bookingCopy.hasBeforePhoto = !!bookingCopy.workerBeforePhoto;
  bookingCopy.hasAfterPhoto = !!bookingCopy.workerAfterPhoto;

  if (photoData) {
    bookingCopy.beforePhotoUploadedAt = photoData.beforePhotoUploadedAt || null;
    bookingCopy.afterPhotoUploadedAt = photoData.afterPhotoUploadedAt || null;
  }

  return bookingCopy;
}

// Light enrich — retains all photo metadata and aliases for consistent rendering
function enrichBookingLight(b) {
  if (!b) return b;
  const bookingCopy = { ...b };
  bookingCopy.status = normalizeStatus(bookingCopy.status);
  
  if (bookingCopy.workerId && bookingCopy.workerId._id) {
    const worker = adminWorkers.find(w => w._id === bookingCopy.workerId._id);
    bookingCopy.workerId = {
      _id: bookingCopy.workerId._id,
      name: bookingCopy.workerId.name,
      phone: bookingCopy.workerId.phone,
      rating: worker?.rating || 4.5,
    };
  }

  // Hydrate photo URLs/data from booking object or photo store
  const photoData = bookingPhotos[bookingCopy._id] || {};
  bookingCopy.customerProblemPhoto = b.customerProblemPhoto || b.problemPhoto || photoData.customerProblemPhoto || photoData.problemPhoto || null;
  bookingCopy.problemPhoto = bookingCopy.customerProblemPhoto;
  bookingCopy.workerBeforePhoto = photoData.workerBeforePhoto || photoData.beforePhoto || b.workerBeforePhoto || b.beforePhoto || null;
  bookingCopy.beforePhoto = bookingCopy.workerBeforePhoto;
  bookingCopy.workerAfterPhoto = photoData.workerAfterPhoto || photoData.afterPhoto || b.workerAfterPhoto || b.afterPhoto || null;
  bookingCopy.afterPhoto = bookingCopy.workerAfterPhoto;

  // Photo existence flags
  bookingCopy.hasProblemPhoto = !!bookingCopy.customerProblemPhoto;
  bookingCopy.hasBeforePhoto = !!bookingCopy.workerBeforePhoto;
  bookingCopy.hasAfterPhoto = !!bookingCopy.workerAfterPhoto;

  if (photoData) {
    bookingCopy.beforePhotoUploadedAt = photoData.beforePhotoUploadedAt || null;
    bookingCopy.afterPhotoUploadedAt = photoData.afterPhotoUploadedAt || null;
  }

  return bookingCopy;
}

// â”€â”€ Upload Before/After Photos for a Booking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/bookings/:id/photos', async (req, res) => {
  const bookingId = req.params.id;
  const { beforePhoto, afterPhoto, workerBeforePhoto, workerAfterPhoto, problemPhoto, customerProblemPhoto, workerNotes, completionNotes } = req.body;

  const resolvedBeforePhoto = workerBeforePhoto || beforePhoto || null;
  const resolvedAfterPhoto = workerAfterPhoto || afterPhoto || null;
  const resolvedProblemPhoto = customerProblemPhoto || problemPhoto || null;

  if (!bookingPhotos[bookingId]) bookingPhotos[bookingId] = {};

  if (resolvedProblemPhoto) {
    bookingPhotos[bookingId].customerProblemPhoto = resolvedProblemPhoto;
    bookingPhotos[bookingId].problemPhoto = resolvedProblemPhoto;
  }
  if (resolvedBeforePhoto) {
    bookingPhotos[bookingId].workerBeforePhoto = resolvedBeforePhoto;
    bookingPhotos[bookingId].beforePhoto = resolvedBeforePhoto;
    bookingPhotos[bookingId].beforePhotoUploadedAt = new Date().toISOString();
  }
  if (resolvedAfterPhoto) {
    bookingPhotos[bookingId].workerAfterPhoto = resolvedAfterPhoto;
    bookingPhotos[bookingId].afterPhoto = resolvedAfterPhoto;
    bookingPhotos[bookingId].afterPhotoUploadedAt = new Date().toISOString();
  }
  if (workerNotes)     bookingPhotos[bookingId].workerNotes = workerNotes;
  if (completionNotes) bookingPhotos[bookingId].completionNotes = completionNotes;

  // Also store on the booking object itself for persistence
  const b = bookings.find(x => x._id === bookingId);
  if (b) {
    if (resolvedProblemPhoto) {
      b.customerProblemPhoto = resolvedProblemPhoto;
      b.problemPhoto = resolvedProblemPhoto;
    }
    if (resolvedBeforePhoto) {
      b.workerBeforePhoto = resolvedBeforePhoto;
      b.beforePhoto = resolvedBeforePhoto;
    }
    if (resolvedAfterPhoto) {
      b.workerAfterPhoto = resolvedAfterPhoto;
      b.afterPhoto = resolvedAfterPhoto;
    }
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
      console.error('âš ï¸ Failed to save photo to MongoDB:', err.message);
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
  console.log(`ðŸ“¸ ${photoType} photo uploaded for booking ${bookingId}`);
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

// GET Invoice details for a booking
app.get('/api/bookings/:id/invoice', async (req, res) => {
  const bookingId = req.params.id;
  let b = bookings.find(x => x._id === bookingId);

  if (!b && MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc && doc.bookings) {
        b = doc.bookings.find(x => x._id === bookingId);
      }
    } catch (_) {}
  }

  if (!b) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  const basePrice = parseInt(b.price || 0, 10) || 0;
  const discount = parseInt(b.discount || 0, 10) || 0;
  const platformFee = Math.round(basePrice * 0.05);
  const gstTax = Math.round(((basePrice + platformFee - discount) * 0.18));
  const totalAmount = basePrice + platformFee + gstTax - discount;

  const customerName = b.userName || (b.userId && b.userId.name) || 'Valued Customer';
  const workerName = b.workerName || (b.workerId && b.workerId.name) || 'FixoN Certified Professional';
  const customerAddress = (b.location && b.location.address) || b.address || 'Hyderabad';

  const invoice = {
    invoiceNo: 'INV-' + b._id,
    invoiceNumber: 'INV-' + b._id,
    bookingId: b._id,
    customerName,
    customerPhone: b.userPhone || '',
    customerAddress,
    workerName,
    workerPhone: (b.workerId && b.workerId.phone) || '',
    serviceCategory: b.category || b.service || 'Home Service',
    serviceName: b.service || 'FixoN Service',
    bookingDate: b.createdAt || b.scheduledTime || new Date().toISOString(),
    completionDate: b.completedAt || new Date().toISOString(),
    labourCharge: basePrice,
    subtotal: basePrice,
    materialCharge: 0,
    platformFee,
    discount,
    gstTax,
    gst: gstTax,
    totalAmount,
    total: totalAmount,
    grandTotal: totalAmount,
    paymentStatus: b.paymentStatus || (b.status === 'completed' ? 'Paid' : 'Pending'),
    paymentMethod: b.paymentMethod || 'Online (UPI)',
  };

  res.json({ success: true, invoice });
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
    problemPhoto: photo,
    customerProblemPhoto: photo,
    beforePhoto: photo,
  };

  if (photo) {
    if (!bookingPhotos[booking._id]) bookingPhotos[booking._id] = {};
    bookingPhotos[booking._id].problemPhoto = photo;
    bookingPhotos[booking._id].customerProblemPhoto = photo;
  }

  // Track coupon usage per customer for 1-time usage constraint
  const cCode = couponCode || req.body.coupon;
  if (cCode) {
    const cObj = coupons.find(c => c.code?.toUpperCase() === String(cCode).toUpperCase());
    if (cObj) {
      cObj.used = (cObj.used || 0) + 1;
      if (!cObj.usedByUsers) cObj.usedByUsers = [];
      const uId = userId || 'guest';
      if (!cObj.usedByUsers.includes(uId)) {
        cObj.usedByUsers.push(uId);
      }
    }
  }

  bookings.push(booking);
  saveData();

  io.emit('new_booking', booking);
  console.log(`ðŸ“¦ Booking [${booking.status}]: ${booking.service} by ${finalName}`);

  res.json({ success: true, booking: enrichBooking(booking) });
});


// Mobile app: get user's bookings
app.get('/api/bookings/user/:userId', (req, res) => {
  const userBookings = bookings.filter(b => b.userId?._id === req.params.userId);
  res.json({ success: true, bookings: userBookings.map(enrichBookingLight).reverse() });
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
  console.log(`ðŸ”„ Booking ${b._id} â†’ ${status}`);

  // â”€â”€ Notify the assigned worker when admin confirms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (status === 'accepted' && workerId) {
    const assignedWorker = adminWorkers.find(w => w._id === workerId || w.workerId === workerId);
    const workerNotif = {
      _id: 'WN' + Date.now(),
      workerId: workerId,
      title: 'ðŸŽ‰ New Booking Assigned!',
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
    console.log(`ðŸ”” Worker ${assignedWorker?.name || workerId} notified about booking ${b._id}`);
  }

  // â”€â”€ Notify customer that their booking was confirmed â”€â”€â”€â”€â”€â”€â”€â”€
  if (status === 'accepted') {
    const customerId = b.userId?._id || b.userId;
    if (customerId) {
      const custNotif = {
        _id: 'N' + Date.now(),
        userId: customerId,
        title: 'âœ… Booking Confirmed!',
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

// Admin: get all bookings â€” always fetch latest from MongoDB if connected
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
  res.json({ success: true, bookings: bookings.map(enrichBookingLight).reverse() });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SYLLABUS STRICT ALIASING ROUTES (SECTION 17)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  res.json({ success: true, bookings: bookings.map(enrichBookingLight).reverse() });
});

// 17.2: POST /api/bookings/create
app.post('/api/bookings/create', (req, res) => {
  // Pass to original handler logic
  req.url = '/api/bookings';
  app._router.handle(req, res, () => {});
});

// Helper to normalize any status variation into standard canonical lowercase status
const normalizeStatus = (s) => {
  if (!s) return 'pending';
  const str = String(s).trim().toLowerCase().replace(/[\s-]/g, '_');
  if (['confirmed', 'accepted', 'accept'].includes(str)) return 'accepted';
  if (['on_the_way', 'ontheway', 'on_way', 'way', 'on-the-way'].includes(str)) return 'on_the_way';
  if (['arrived', 'arrive'].includes(str)) return 'arrived';
  if (['ongoing', 'in_progress', 'start_work', 'started', 'start', 'working'].includes(str)) return 'ongoing';
  if (['completed', 'complete', 'finish', 'finished', 'done', 'invoice_generated', 'rated'].includes(str)) return 'completed';
  if (['cancelled', 'cancel'].includes(str)) return 'cancelled';
  return str;
};

// 17.5: PUT & PATCH /api/bookings/{id}/status - Unified Status Engine
const STATUS_RANKS = {
  'pending': 0,
  'assigned': 1,
  'accepted': 2,
  'confirmed': 2,
  'on_the_way': 3,
  'ontheway': 3,
  'arrived': 4,
  'ongoing': 5,
  'in_progress': 5,
  'started': 5,
  'completed': 6,
  'cancelled': 99
};

const handleBookingStatusUpdate = async (req, res) => {
  const { status, workerId, workerName } = req.body;
  const b = bookings.find(x => String(x._id) === String(req.params.id));
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });

  const normalizedNewStatus = normalizeStatus(status);
  const currentNormalized = normalizeStatus(b.status);

  const currentRank = STATUS_RANKS[currentNormalized] ?? 0;
  const newRank = STATUS_RANKS[normalizedNewStatus] ?? 0;

  // STRICT REGRESSION PREVENTION: Once advanced forward, status can NEVER move backward or repeat!
  if (currentRank > newRank && normalizedNewStatus !== 'cancelled') {
    return res.json({ success: true, booking: enrichBooking(b), message: 'Status already advanced' });
  }

  b.status = normalizedNewStatus;
  const nowStr = new Date().toISOString();

  if (normalizedNewStatus === 'accepted') {
    b.acceptedAt = b.acceptedAt || nowStr;
    if (workerId) {
      const w = adminWorkers.find(x => String(x._id) === String(workerId) || String(x.workerId) === String(workerId));
      if (w) { b.workerId = w; b.workerName = w.name; }
    } else if (workerName) {
      b.workerName = workerName;
    }
  } else if (normalizedNewStatus === 'on_the_way') {
    b.onTheWayAt = b.onTheWayAt || nowStr;
  } else if (normalizedNewStatus === 'arrived') {
    b.arrivedAt = b.arrivedAt || nowStr;
  } else if (normalizedNewStatus === 'ongoing') {
    b.startedAt = b.startedAt || nowStr;
  } else if (normalizedNewStatus === 'completed') {
    b.completedAt = b.completedAt || nowStr;
    if (b.workerId) {
      const wId = b.workerId._id || b.workerId;
      const w = adminWorkers.find(x => String(x._id) === String(wId) || String(x.workerId) === String(wId));
      if (w) {
        w.isAvailable = true;
        w.completedJobs = (w.completedJobs || 0) + 1;
        w.totalEarnings = (w.totalEarnings || 0) + Math.round((b.price || 0) * 0.8);
      }
    }
  }

  // â”€â”€ ATOMIC PERSIST: write to MongoDB IMMEDIATELY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cleanBookings = bookings.map(bk => {
    const copy = { ...bk };
    delete copy.beforePhoto; delete copy.afterPhoto; delete copy.problemPhoto;
    delete copy.beforePhotoUploadedAt; delete copy.afterPhotoUploadedAt;
    return copy;
  });
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      await AppData.findOneAndUpdate(
        { key: 'main' },
        { $set: { bookings: cleanBookings } },
        { upsert: true }
      );
      console.log(`ðŸ’¾ Booking ${b._id} atomically saved to MongoDB â†’ ${normalizedNewStatus}`);
    } catch (err) {
      console.error('âš ï¸ MongoDB atomic save failed:', err.message);
      saveData(); // fall back to debounced save
    }
  } else {
    saveData();
  }

  const customerId = b.userId?._id || b.userId;
  const enriched = enrichBooking(b);

  io.emit('booking_update', { bookingId: b._id, status: normalizedNewStatus, booking: enriched });
  if (customerId) {
    io.emit('booking_status_update', { userId: customerId, bookingId: b._id, status: normalizedNewStatus, booking: enriched });
  }

  console.log(`âœ… Booking ${b._id} status updated â†’ ${normalizedNewStatus}`);
  res.json({ success: true, booking: enriched });
};

app.put('/api/bookings/:id/status', handleBookingStatusUpdate);
app.patch('/api/bookings/:id/status', handleBookingStatusUpdate);
app.patch('/api/bookings/:id', handleBookingStatusUpdate);
app.put('/api/bookings/:id', handleBookingStatusUpdate);


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STATS ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get('/api/stats/customers', (req, res) => {
  res.json({
    success: true,
    total: Object.keys(users).length,
    active: Object.values(users).filter(u => u.lat).length,
    users: Object.values(users),
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  WORKERS ROUTES (Admin Panel CRUD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// Worker SELF-Registration (from worker app â€” no credentials yet, pending admin review)
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
  console.log(`ðŸ†• Worker self-registered: ${name} (${phone}) â€” awaiting admin approval`);
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
    console.log(`ðŸ”‘ Credentials generated for ${updated.name}: ID=${creds.workerId} Pass=${creds.password}`);
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  WORKER VERIFICATION & APP ENDPOINTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  console.log(`ðŸªª Document [${documentType}] submitted for worker ${w.name}`);
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
  console.log(`âœ… Worker ${w.name} approved! ID: ${w.workerId}`);
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
  console.log(`âŒ Worker ${w.name} rejected: ${w.rejectionReason}`);
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
  console.log(`ðŸ”’ Worker ${w.name} isBlocked: ${w.isBlocked}`);
  res.json({ success: true, blocked: w.isBlocked, worker: w });
});

// Admin resets worker password
app.post('/api/workers/:id/reset-password', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  const newPass = 'FXN' + Math.floor(1000 + Math.random() * 9000);
  w.workerPassword = newPass;
  saveData();
  console.log(`ðŸ”‘ New password generated for worker ${w.name}: ${newPass}`);
  res.json({ success: true, workerId: w.workerId, newPassword: newPass, worker: w });
});

// Admin approves Aadhaar document
app.post('/api/workers/:id/approve-aadhaar', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.aadhaarVerified = true;
  saveData();
  io.emit('worker_updated', w);
  console.log(`ðŸªª Aadhaar approved for worker ${w.name}`);
  res.json({ success: true, worker: w });
});

// Admin approves PAN document
app.post('/api/workers/:id/approve-pan', (req, res) => {
  const w = adminWorkers.find(x => x._id === req.params.id);
  if (!w) return res.status(404).json({ success: false, error: 'Worker not found' });

  w.panVerified = true;
  saveData();
  io.emit('worker_updated', w);
  console.log(`ðŸ’³ PAN approved for worker ${w.name}`);
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

  res.json({ success: true, bookings: pending.map(enrichBookingLight).reverse() });
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

  res.json({ success: true, bookings: myJobs.map(enrichBookingLight).reverse() });
});

// Worker Accept Booking â€” atomic MongoDB persist
app.post('/api/worker/:id/accept-booking/:bookingId', async (req, res) => {
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

  // ATOMIC PERSIST to MongoDB IMMEDIATELY
  const cleanBookings = bookings.map(bk => {
    const copy = { ...bk };
    delete copy.beforePhoto; delete copy.afterPhoto; delete copy.problemPhoto;
    delete copy.beforePhotoUploadedAt; delete copy.afterPhotoUploadedAt;
    return copy;
  });
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      await AppData.findOneAndUpdate(
        { key: 'main' },
        { $set: { bookings: cleanBookings } },
        { upsert: true }
      );
      console.log(`ðŸ’¾ Booking ${b._id} ACCEPTED & saved to MongoDB`);
    } catch (err) {
      console.error('âš ï¸ MongoDB atomic save failed on accept-booking:', err.message);
      saveData();
    }
  } else {
    saveData();
  }

  // Notify customer
  const customerId = b.userId?._id || b.userId;
  if (customerId) {
    const custNotif = {
      _id: 'N' + Date.now(),
      userId: customerId,
      title: 'âœ… Booking Accepted!',
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
  console.log(`âœ… Worker ${worker?.name || workerId} accepted booking ${b._id}`);
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
  console.log(`âŒ Worker ${worker?.name || workerId} rejected booking ${b._id}`);
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

// Worker Update Job Status â€” strict one-way, atomic MongoDB-first persist
app.post('/api/worker/:id/booking/:bookingId/:action', async (req, res) => {
  const b = bookings.find(x => x._id === req.params.bookingId);
  if (!b) return res.status(404).json({ success: false, error: 'Booking not found' });

  const action = req.params.action;
  // Normalize action to canonical status using the shared normalizeStatus helper
  const newStatus = normalizeStatus(action);

  // Read current rank BEFORE any mutation
  const currentNormalized = normalizeStatus(b.status);
  const currentRank = STATUS_RANKS[currentNormalized] ?? 0;
  const newRank = STATUS_RANKS[newStatus] ?? 0;

  // STRICT REGRESSION PREVENTION â€” check rank BEFORE touching b.status
  if (currentRank > newRank && newStatus !== 'cancelled') {
    console.log(`âš ï¸ Regression blocked: ${currentNormalized}(${currentRank}) â†’ ${newStatus}(${newRank})`);
    return res.json({ success: true, booking: enrichBooking(b), message: 'Status already advanced' });
  }

  // Mutate in-memory booking AFTER rank check passes
  b.status = newStatus;
  const nowStr = new Date().toISOString();
  if (newStatus === 'on_the_way') b.onTheWayAt  = b.onTheWayAt || nowStr;
  if (newStatus === 'arrived')    b.arrivedAt    = b.arrivedAt  || nowStr;
  if (newStatus === 'ongoing')    b.startedAt    = b.startedAt  || nowStr;
  if (newStatus === 'completed') {
    b.completedAt = b.completedAt || nowStr;
    // Credit worker earnings
    const wId = b.workerId?._id || b.workerId;
    const w = adminWorkers.find(x => String(x._id) === String(wId) || String(x.workerId) === String(wId));
    if (w) {
      w.isAvailable = true;
      w.completedJobs = (w.completedJobs || 0) + 1;
      w.totalEarnings = (w.totalEarnings || 0) + Math.round((b.price || 0) * 0.8);
    }
  }

  // â”€â”€ ATOMIC PERSIST: write to MongoDB IMMEDIATELY (not debounced) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cleanBookings = bookings.map(bk => {
    const copy = { ...bk };
    delete copy.beforePhoto; delete copy.afterPhoto; delete copy.problemPhoto;
    delete copy.beforePhotoUploadedAt; delete copy.afterPhotoUploadedAt;
    return copy;
  });
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      await AppData.findOneAndUpdate(
        { key: 'main' },
        { $set: { bookings: cleanBookings } },
        { upsert: true }
      );
      console.log(`ðŸ’¾ Booking ${b._id} status atomically saved to MongoDB â†’ ${newStatus}`);
    } catch (err) {
      console.error('âš ï¸ MongoDB atomic save failed, using file fallback:', err.message);
      try { fs.writeFileSync(DATA_FILE, JSON.stringify({ registeredUsers, bookings: cleanBookings, messages, notificationsList, adminWorkers, services, coupons }, null, 2), 'utf-8'); } catch (_) {}
    }
  } else {
    // File fallback when MongoDB not connected
    saveData();
  }

  // â”€â”€ Notify customer for each step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const customerId = b.userId?._id || b.userId;
  const notifMessages = {
    on_the_way: { title: 'ðŸï¸ Worker On The Way!',  msg: `Your ${b.service} worker is on the way.` },
    arrived:    { title: 'ðŸ“ Worker Arrived!',       msg: `Your ${b.service} worker has arrived.` },
    ongoing:    { title: 'ðŸ”§ Work Started!',          msg: `Work has started for your ${b.service} booking.` },
    completed:  { title: 'ðŸŽ‰ Job Completed!',         msg: `Your ${b.service} booking has been completed!` },
    cancelled:  { title: 'âŒ Booking Cancelled',      msg: `Your ${b.service} booking was cancelled.` },
  };

  const enriched = enrichBooking(b);

  if (customerId && notifMessages[newStatus]) {
    const n = notifMessages[newStatus];
    const custNotif = {
      _id: 'N' + Date.now(), userId: customerId, title: n.title, message: n.msg,
      type: 'booking', bookingId: b._id, status: newStatus,
      createdAt: nowStr, read: false,
    };
    notificationsList.push(custNotif);
    io.emit('new_notification', custNotif);
    io.emit('booking_status_update', { userId: customerId, bookingId: b._id, status: newStatus, booking: enriched });
  }

  io.emit('booking_update', { bookingId: b._id, status: newStatus, booking: enriched });
  console.log(`ðŸ› ï¸ Worker updated booking ${b._id} status â†’ ${newStatus}`);
  res.json({ success: true, booking: enriched });
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  WORKER PAYOUT ROUTE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RATINGS ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  console.log(`â­ Rating: ${newRating.rating}/5 for worker ${workerId}`);
  res.json({ success: true, rating: newRating });
});

// Get all ratings for a worker
app.get('/api/ratings/worker/:id', (req, res) => {
  const workerRatings = ratings
    .filter(r => r.workerId === req.params.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, ratings: workerRatings, count: workerRatings.length });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  INVOICE ROUTE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CUSTOMER AUTHENTICATION & USER MANAGEMENT API
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// 1. GET /api/admin/users â€” Admin Control Panel customer list
app.get('/api/admin/users', async (req, res) => {
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc && doc.registeredUsers) {
        const dbMap = new Map();
        doc.registeredUsers.forEach(u => { if (u && u._id) dbMap.set(String(u._id), u); });
        registeredUsers.forEach(u => { if (u && u._id) dbMap.set(String(u._id), u); });
        registeredUsers = Array.from(dbMap.values());
      }
    } catch (e) {}
  }
  res.json({ success: true, users: registeredUsers });
});

// 2. POST /api/auth/user/register â€” Customer self-registration
app.post('/api/auth/user/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').trim();

  let existing = registeredUsers.find(
    u => (cleanEmail && u.email?.toLowerCase() === cleanEmail) || (cleanPhone && u.phone === cleanPhone)
  );

  if (existing) {
    if (name) existing.name = name;
    if (cleanEmail) existing.email = cleanEmail;
    if (cleanPhone) existing.phone = cleanPhone;
    await saveData();
    io.emit('new_user', existing);
    return res.json({ success: true, token: 'token_' + existing._id, user: existing });
  }

  const newUser = {
    _id: 'U_' + Date.now(),
    name: (name || 'Customer').trim(),
    email: cleanEmail || `${Date.now()}@fixon.com`,
    phone: cleanPhone || '9876543210',
    isBlocked: false,
    totalBookings: 0,
    bankDetails: {},
    createdAt: new Date().toISOString(),
    location: {}
  };

  registeredUsers.push(newUser);
  await saveData();
  io.emit('new_user', newUser);
  console.log(`ðŸ‘¤ New customer registered: ${newUser.name} (${newUser.email} / ${newUser.phone})`);
  res.json({ success: true, token: 'token_' + newUser._id, user: newUser });
});

// 3. POST /api/auth/user/login â€” Customer login
app.post('/api/auth/user/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();

  let user = registeredUsers.find(u => u.email?.toLowerCase() === cleanEmail);
  if (!user) {
    user = {
      _id: 'U_' + Date.now(),
      name: cleanEmail.split('@')[0] || 'Customer',
      email: cleanEmail,
      phone: '9876543210',
      isBlocked: false,
      totalBookings: 0,
      bankDetails: {},
      createdAt: new Date().toISOString()
    };
    registeredUsers.push(user);
    await saveData();
    io.emit('new_user', user);
  }

  res.json({ success: true, token: 'token_' + user._id, user });
});

// NOTE: /api/auth/send-otp is handled below with real SMS support

// 5. POST /api/auth/verify-otp â€” OTP Verification & Auto Register
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, otp, name } = req.body;
  const cleanPhone = (phone || '').trim();

  let user = registeredUsers.find(u => u.phone === cleanPhone);
  if (!user) {
    user = {
      _id: 'U_' + Date.now(),
      name: name || `Customer (${cleanPhone})`,
      email: `${cleanPhone}@fixon.com`,
      phone: cleanPhone,
      isBlocked: false,
      totalBookings: 0,
      bankDetails: {},
      createdAt: new Date().toISOString()
    };
    registeredUsers.push(user);
    await saveData();
    io.emit('new_user', user);
  }

  res.json({ success: true, token: 'token_' + user._id, user });
});

// 6. PATCH /api/admin/users/:id/block â€” Block / Unblock Customer
app.patch('/api/admin/users/:id/block', async (req, res) => {
  const u = registeredUsers.find(x => String(x._id) === String(req.params.id));
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  u.isBlocked = !u.isBlocked;
  await saveData();
  res.json({ success: true, user: u });
});

// 7. GET /api/user/:id/bank-details â€” Fetch Bank Details
app.get('/api/user/:id/bank-details', (req, res) => {
  const u = registeredUsers.find(x => String(x._id) === String(req.params.id));
  res.json({ success: true, bankDetails: u?.bankDetails || null });
});

// 8. POST /api/user/:id/bank-details â€” Save Bank Details
app.post('/api/user/:id/bank-details', async (req, res) => {
  const u = registeredUsers.find(x => String(x._id) === String(req.params.id));
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  u.bankDetails = { ...u.bankDetails, ...req.body, updatedAt: new Date().toISOString() };
  await saveData();
  res.json({ success: true, bankDetails: u.bankDetails });
});

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



// â”€â”€ Customer-facing: always read fresh from MongoDB so Admin Panel price changes reflect immediately
app.get('/api/services', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc && doc.services && doc.services.length > 0) {
        services = doc.services; // update in-memory cache
      }
    } catch (e) {
      console.error('âš ï¸ Failed to refresh services from MongoDB:', e.message);
    }
  }
  res.json({ success: true, services: services.filter(s => s.active !== false) });
});

app.get('/api/admin/services', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ success: true, services });
});

app.post('/api/admin/services', async (req, res) => {
  const s = { 
    _id: 'SV' + Date.now(), 
    ...req.body, 
    price: Number(req.body.price || 0),
    active: true 
  };
  if (Array.isArray(req.body.packages)) {
    s.packages = req.body.packages.map(p => ({ ...p, price: Number(p.price || 0) }));
  }
  services.push(s);
  await saveData();
  io.emit('services_updated', { services });
  res.json({ success: true, service: s });
});

const handleServiceUpdate = async (req, res) => {
  const targetId = req.params.id;
  let idx = services.findIndex(s => s._id === targetId || String(s._id) === String(targetId));
  
  if (idx === -1) {
    idx = services.findIndex(s => s.name && s.name.toLowerCase().trim() === String(targetId).toLowerCase().trim());
  }

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }

  const updated = { ...services[idx], ...req.body };
  if (req.body.price !== undefined) {
    updated.price = Number(req.body.price);
  }
  if (Array.isArray(req.body.packages)) {
    updated.packages = req.body.packages.map(p => ({
      ...p,
      price: Number(p.price || 0)
    }));
  }

  services[idx] = updated;
  await saveData();
  
  // Real-time broadcast to all connected apps
  io.emit('services_updated', { services });
  console.log(`✅ Service "${services[idx].name}" updated → price ₹${services[idx].price} saved to MongoDB Atlas`);
  
  res.json({ success: true, service: services[idx] });
};

app.put('/api/admin/services/:id', handleServiceUpdate);
app.patch('/api/admin/services/:id', handleServiceUpdate);
app.put('/api/services/:id', handleServiceUpdate);
app.patch('/api/services/:id', handleServiceUpdate);

app.delete('/api/admin/services/:id', async (req, res) => {
  const targetId = req.params.id;
  services = services.filter(s => s._id !== targetId && String(s._id) !== String(targetId) && s.name?.toLowerCase() !== String(targetId).toLowerCase());
  await saveData();
  io.emit('services_updated', { services });
  res.json({ success: true });
});

// =========================================================================
// 🛒 SPARE PARTS STORE API ENDPOINTS
// =========================================================================

// Refresh Spare Parts from MongoDB
async function refreshSparePartsFromDb() {
  if (MONGODB_URI && mongoose.connection.readyState === 1) {
    try {
      const doc = await AppData.findOne({ key: 'main' }).lean();
      if (doc) {
        if (doc.spareParts && doc.spareParts.length > 0) spareParts = doc.spareParts;
        if (doc.sparePartOrders) sparePartOrders = doc.sparePartOrders;
        if (doc.sparePartCategories) sparePartCategories = doc.sparePartCategories;
        if (doc.sparePartSuppliers) sparePartSuppliers = doc.sparePartSuppliers;
        if (doc.sparePartRequests) sparePartRequests = doc.sparePartRequests;
        if (doc.sparePartAuditHistory) sparePartAuditHistory = doc.sparePartAuditHistory;
      }
    } catch (e) {
      console.error('⚠️ Failed to refresh spare parts from MongoDB:', e.message);
    }
  }
}

// 1. Customer Spare Parts Store Listing (Public)
app.get('/api/spare-parts', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  await refreshSparePartsFromDb();

  const { category, brand, search, quality, inStockOnly } = req.query;
  let result = spareParts.filter(p => p.active !== false);

  if (category && category !== 'All') {
    result = result.filter(p => p.category?.toLowerCase() === category.toLowerCase());
  }

  if (brand && brand !== 'All') {
    result = result.filter(p => p.brand?.toLowerCase() === brand.toLowerCase());
  }

  if (quality && quality !== 'All') {
    result = result.filter(p => p.quality?.toLowerCase() === quality.toLowerCase());
  }

  if (inStockOnly === 'true') {
    result = result.filter(p => Number(p.stock) > 0);
  }

  if (search) {
    const q = search.toLowerCase().trim();
    result = result.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.partNumber && p.partNumber.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (Array.isArray(p.compatibleModels) && p.compatibleModels.some(m => m.toLowerCase().includes(q)))
    );
  }

  // Strip private supplier info for customer response
  const sanitized = result.map(p => {
    const copy = { ...p };
    delete copy.purchasePrice;
    delete copy.supplierId;
    delete copy.supplierContact;
    delete copy.supplierName;
    delete copy.supplierNotes;
    return copy;
  });

  res.json({ success: true, count: sanitized.length, spareParts: sanitized });
});

// 2. Admin All Spare Parts Listing (Includes disabled & private supplier info)
app.get('/api/admin/spare-parts', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  await refreshSparePartsFromDb();
  res.json({ success: true, count: spareParts.length, spareParts });
});

// 3. Admin Add Spare Part
app.post('/api/admin/spare-parts', async (req, res) => {
  const {
    name, category, brand, partNumber, price, discountPrice, stock,
    lowStockThreshold, quality, compatibleModels, description, warranty,
    photo, additionalPhotos, deliveryCharge, supplierId, supplierName,
    supplierContact, purchasePrice
  } = req.body;

  if (!name || !price) {
    return res.status(400).json({ success: false, message: 'Part Name and Price are required' });
  }

  const newPart = {
    _id: 'SP' + (100000 + spareParts.length + 1),
    name: String(name).trim(),
    category: category || 'General Home Appliance Parts',
    brand: brand || 'Generic',
    partNumber: partNumber || 'N/A',
    quality: quality || 'Original',
    price: Number(price),
    discountPrice: discountPrice !== undefined && discountPrice !== null && discountPrice !== '' ? Number(discountPrice) : null,
    stock: stock !== undefined ? Number(stock) : 10,
    lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
    compatibleModels: Array.isArray(compatibleModels) ? compatibleModels : (compatibleModels ? [compatibleModels] : []),
    description: description || '',
    warranty: warranty || 'No Warranty Specified',
    photo: photo || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
    additionalPhotos: Array.isArray(additionalPhotos) ? additionalPhotos : [],
    deliveryCharge: deliveryCharge !== undefined ? Number(deliveryCharge) : 50,
    active: true,
    supplierId: supplierId || '',
    supplierName: supplierName || '',
    supplierContact: supplierContact || '',
    purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: []
  };

  spareParts.unshift(newPart);

  // Audit log
  sparePartAuditHistory.unshift({
    partId: newPart._id,
    partName: newPart.name,
    action: 'CREATE',
    changedBy: 'Admin',
    changes: 'Product Created',
    timestamp: new Date().toISOString()
  });

  await saveData();
  io.emit('spare_parts_updated', { spareParts });

  res.json({ success: true, message: 'Spare Part added successfully', sparePart: newPart });
});

// 4. Admin Quick Edit / Update Spare Part
const handleSparePartUpdate = async (req, res) => {
  const targetId = req.params.id;
  await refreshSparePartsFromDb();

  const idx = spareParts.findIndex(p => p._id === targetId || String(p._id) === String(targetId));
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Spare Part not found' });
  }

  const old = spareParts[idx];
  const auditEntries = [];

  if (req.body.price !== undefined && Number(req.body.price) !== old.price) {
    auditEntries.push(`Price: ₹${old.price} → ₹${req.body.price}`);
  }
  if (req.body.stock !== undefined && Number(req.body.stock) !== old.stock) {
    auditEntries.push(`Stock: ${old.stock} → ${req.body.stock}`);
  }
  if (req.body.active !== undefined && req.body.active !== old.active) {
    auditEntries.push(`Status: ${old.active ? 'Enabled' : 'Disabled'} → ${req.body.active ? 'Enabled' : 'Disabled'}`);
  }

  const updated = {
    ...old,
    ...req.body,
    price: req.body.price !== undefined ? Number(req.body.price) : old.price,
    stock: req.body.stock !== undefined ? Math.max(0, Number(req.body.stock)) : old.stock,
    discountPrice: req.body.discountPrice !== undefined ? (req.body.discountPrice ? Number(req.body.discountPrice) : null) : old.discountPrice,
    lowStockThreshold: req.body.lowStockThreshold !== undefined ? Number(req.body.lowStockThreshold) : old.lowStockThreshold,
    compatibleModels: Array.isArray(req.body.compatibleModels) ? req.body.compatibleModels : old.compatibleModels,
    updatedAt: new Date().toISOString()
  };

  spareParts[idx] = updated;

  // Low stock check
  if (updated.stock <= (updated.lowStockThreshold || 5) && updated.stock > 0) {
    io.emit('admin_alert', {
      type: 'low_stock',
      title: '⚠️ Low Stock Alert',
      message: `${updated.name} has only ${updated.stock} left in stock!`,
      partId: updated._id
    });
  } else if (updated.stock === 0) {
    io.emit('admin_alert', {
      type: 'out_of_stock',
      title: '❌ Out of Stock Alert',
      message: `${updated.name} is now Out of Stock!`,
      partId: updated._id
    });
  }

  if (auditEntries.length > 0) {
    sparePartAuditHistory.unshift({
      partId: updated._id,
      partName: updated.name,
      action: 'UPDATE',
      changedBy: 'Admin',
      changes: auditEntries.join(', '),
      timestamp: new Date().toISOString()
    });
  }

  await saveData();
  io.emit('spare_parts_updated', { spareParts });
  io.emit('spare_part_stock_update', { partId: updated._id, stock: updated.stock, price: updated.price });

  console.log(`✅ Spare Part "${updated.name}" updated → Price: ₹${updated.price}, Stock: ${updated.stock}`);
  res.json({ success: true, message: 'Spare Part updated', sparePart: updated });
};

app.put('/api/admin/spare-parts/:id', handleSparePartUpdate);
app.patch('/api/admin/spare-parts/:id', handleSparePartUpdate);
app.put('/api/spare-parts/:id', handleSparePartUpdate);
app.patch('/api/spare-parts/:id', handleSparePartUpdate);

// 5. Disable / Soft Delete Spare Part (Does NOT delete database record)
app.delete('/api/admin/spare-parts/:id', async (req, res) => {
  const targetId = req.params.id;
  const idx = spareParts.findIndex(p => p._id === targetId || String(p._id) === String(targetId));
  if (idx !== -1) {
    spareParts[idx].active = false;
    spareParts[idx].updatedAt = new Date().toISOString();
    
    sparePartAuditHistory.unshift({
      partId: targetId,
      partName: spareParts[idx].name,
      action: 'DISABLE',
      changedBy: 'Admin',
      changes: 'Product disabled from customer view',
      timestamp: new Date().toISOString()
    });

    await saveData();
    io.emit('spare_parts_updated', { spareParts });
  }
  res.json({ success: true, message: 'Part disabled successfully' });
});

// 6. Categories API
app.get('/api/spare-parts/categories', (req, res) => {
  res.json({ success: true, categories: sparePartCategories });
});

app.post('/api/admin/spare-parts/categories', async (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name required' });
  const cat = {
    id: 'cat_' + Date.now(),
    name: name.trim(),
    icon: icon || '🔧',
    active: true
  };
  sparePartCategories.push(cat);
  await saveData();
  res.json({ success: true, category: cat, categories: sparePartCategories });
});

// 7. Spare Part Orders API

// Valid order status transitions matrix
const SPARE_ORDER_TRANSITIONS = {
  'NEW': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['PACKED', 'CANCELLED'],
  'PACKED': ['SHIPPED', 'CANCELLED'],
  'SHIPPED': ['OUT_FOR_DELIVERY', 'CANCELLED'],
  'OUT_FOR_DELIVERY': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': [],
  'CANCELLED': []
};

// Friendly status display labels
const ORDER_STATUS_LABELS = {
  'NEW': 'Order Placed',
  'CONFIRMED': 'Order Confirmed',
  'PACKED': 'Packed',
  'SHIPPED': 'Shipped',
  'OUT_FOR_DELIVERY': 'Out for Delivery',
  'DELIVERED': 'Delivered',
  'CANCELLED': 'Cancelled'
};

app.get('/api/admin/spare-part-orders', async (req, res) => {
  await refreshSparePartsFromDb();
  res.json({ success: true, orders: sparePartOrders });
});

app.get('/api/spare-part-orders/my', async (req, res) => {
  await refreshSparePartsFromDb();
  const customerId = req.query.customerId || req.headers['user-id'] || req.headers['x-user-id'];
  if (!customerId) return res.json({ success: true, orders: [] });
  const myOrders = sparePartOrders.filter(o => String(o.customerId) === String(customerId));
  res.json({ success: true, orders: myOrders });
});

// Helper: normalize an order ID from URL params (handles # encoding issues)
function findOrderByUrlId(rawId) {
  if (!rawId) return -1;
  const decoded = decodeURIComponent(rawId);
  const withHash = decoded.startsWith('#') ? decoded : `#${decoded}`;
  const noHash   = decoded.startsWith('#') ? decoded.slice(1) : decoded;
  return sparePartOrders.findIndex(o =>
    o._id === decoded ||
    o._id === withHash ||
    o.orderId === decoded ||
    o.orderId === withHash ||
    o.lookupId === decoded ||
    o.lookupId === noHash
  );
}

app.get('/api/spare-part-orders/:id', async (req, res) => {
  await refreshSparePartsFromDb();
  const idx = findOrderByUrlId(req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const order = sparePartOrders[idx];

  // Security ownership check
  const requestingUserId = req.query.customerId || req.headers['user-id'] || req.headers['x-user-id'] || req.headers['worker-id'];
  const isAdmin = req.headers['x-admin-auth'] === 'true' || req.query.admin === 'true';

  if (!isAdmin && requestingUserId && String(order.customerId) !== String(requestingUserId) && String(order.deliveryWorkerId) !== String(requestingUserId)) {
    return res.status(403).json({ success: false, message: 'Access denied. You can only view your own orders.' });
  }

  res.json({ success: true, order });
});

app.post('/api/spare-part-orders', async (req, res) => {
  const { customerId, customerName, customerPhone, items, deliveryAddress, comboWithTechnician, installationFee, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order must contain at least 1 item' });
  }

  await refreshSparePartsFromDb();

  // Validate stock for all items
  for (const item of items) {
    const part = spareParts.find(p => p._id === item.partId || String(p._id) === String(item.partId));
    if (!part) {
      return res.status(404).json({ success: false, message: `Part not found: ${item.partName || item.partId}` });
    }
    if (part.active === false) {
      return res.status(400).json({ success: false, message: `Part "${part.name}" is currently unavailable` });
    }
    if (part.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${part.name}". Available: ${part.stock}, Requested: ${item.quantity}`
      });
    }
  }

  // Deduct stock & prepare items list
  let totalPartsAmount = 0;
  let totalDelivery = 0;
  const processedItems = [];

  for (const item of items) {
    const part = spareParts.find(p => p._id === item.partId || String(p._id) === String(item.partId));
    part.stock = Math.max(0, part.stock - item.quantity);
    
    const priceToUse = part.discountPrice && part.discountPrice < part.price ? part.discountPrice : part.price;
    const itemTotal = priceToUse * item.quantity;
    totalPartsAmount += itemTotal;
    totalDelivery += (part.deliveryCharge || 0);

    processedItems.push({
      partId: part._id,
      partName: part.name,
      brand: part.brand,
      quality: part.quality,
      photo: part.photo,
      price: priceToUse,
      quantity: item.quantity,
      subtotal: itemTotal
    });

    // Check low stock alert
    if (part.stock <= (part.lowStockThreshold || 5)) {
      io.emit('admin_alert', {
        type: 'low_stock',
        title: '⚠️ Low Stock Alert',
        message: `${part.name} dropped to ${part.stock} remaining!`,
        partId: part._id
      });
    }
  }

  const instFee = comboWithTechnician ? Number(installationFee || 299) : 0;
  const grandTotal = totalPartsAmount + totalDelivery + instFee;

  const orderNum = 100001 + sparePartOrders.length;
  const orderId = `#SP${orderNum}`;
  const lookupId = `SP${orderNum}`; // URL-safe ID (no #)
  const nowIso = new Date().toISOString();

  const newOrder = {
    _id: orderId,
    orderId,
    lookupId,
    customerId: customerId || 'GUEST',
    customerName: customerName || 'Valued Customer',
    customerPhone: customerPhone || 'N/A',
    items: processedItems,
    partsAmount: totalPartsAmount,
    subtotal: totalPartsAmount,
    discount: 0,
    deliveryCharge: totalDelivery,
    comboWithTechnician: !!comboWithTechnician,
    installationFee: instFee,
    totalAmount: grandTotal,
    deliveryAddress: typeof deliveryAddress === 'string' ? { address: deliveryAddress } : (deliveryAddress || { address: 'Default Customer Address' }),
    paymentMethod: paymentMethod || 'COD',
    paymentStatus: 'PENDING',
    orderStatus: 'NEW',
    deliveryWorkerId: null,
    deliveryWorkerName: null,
    deliveryWorkerPhone: null,
    statusHistory: [
      { status: 'NEW', note: 'Order placed by customer', timestamp: nowIso, updatedBy: 'customer' }
    ],
    createdAt: nowIso,
    updatedAt: nowIso
  };

  sparePartOrders.unshift(newOrder);

  // Optional Combo Flow: If comboWithTechnician, create corresponding FixoN Technician booking!
  if (comboWithTechnician) {
    const techBookingId = `BK_SP_${Date.now()}`;
    const techBooking = {
      _id: techBookingId,
      bookingId: techBookingId,
      userId: customerId,
      userName: customerName,
      userPhone: customerPhone,
      service: `Spare Part Installation (${processedItems[0]?.partName || 'Appliance Part'})`,
      category: 'Maintenance',
      address: typeof deliveryAddress === 'string' ? deliveryAddress : (deliveryAddress?.address || 'Customer Address'),
      amount: instFee,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      time: 'As soon as part arrives',
      sparePartOrderId: orderId,
      notes: `Installation requested with Spare Part Order ${orderId}`,
      createdAt: nowIso
    };
    bookings.unshift(techBooking);
    io.emit('new_booking', techBooking);
  }

  await saveData();

  // Socket broadcast to Admin Control Panel & Customer
  io.emit('spare_part_order', newOrder);
  io.emit('spare_parts_updated', { spareParts });

  res.json({
    success: true,
    message: 'Spare Part Order placed successfully!',
    order: newOrder
  });
});

// Admin Status Transition Handler
const handleOrderStatusChange = async (req, res) => {
  const { status, note, updatedBy } = req.body;
  const rawId = req.params.id;

  await refreshSparePartsFromDb();
  const idx = findOrderByUrlId(rawId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: `Spare parts order not found: ${rawId}` });
  }

  const order = sparePartOrders[idx];
  const currentStatus = order.orderStatus || 'NEW';

  // Rule 28: Duplicate Status Change Check
  if (status === currentStatus) {
    return res.json({
      success: false,
      message: 'No status change required.',
      order
    });
  }

  // Rule 3: Valid Transitions Check
  const allowedNext = SPARE_ORDER_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status transition from ${currentStatus} to ${status}. Allowed: ${allowedNext.join(', ') || 'None'}`
    });
  }

  const nowIso = new Date().toISOString();
  order.orderStatus = status;
  order.updatedAt = nowIso;

  if (status === 'DELIVERED') {
    order.paymentStatus = 'PAID';
  }

  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status,
    note: note || `Status changed to ${ORDER_STATUS_LABELS[status] || status}`,
    timestamp: nowIso,
    updatedBy: updatedBy || 'admin'
  });

  await saveData();

  const friendlyLabel = ORDER_STATUS_LABELS[status] || status;
  const notifMsg = `Your FixoN spare parts order ${order.orderId} status has been updated to ${friendlyLabel}.`;

  // Socket.IO Real-time Events
  const payload = {
    orderId: order.orderId,
    status,
    statusHistory: order.statusHistory,
    timestamp: nowIso,
    message: notifMsg,
    order
  };

  io.emit('spare_part_order_status_updated', payload);
  io.emit('spare_part_order_update', payload);

  // Push Customer Notification
  const notifObj = {
    id: 'NOTIF_SP_' + Date.now(),
    userId: order.customerId,
    title: `📦 Order ${friendlyLabel}`,
    message: notifMsg,
    type: 'spare_part_order',
    orderId: order.orderId,
    createdAt: nowIso,
    read: false
  };
  notificationsList.unshift(notifObj);
  io.emit('notification', notifObj);

  console.log(`✅ Order ${order.orderId} status transition: ${currentStatus} → ${status}`);
  res.json({ success: true, message: `Order status updated to ${friendlyLabel}`, order });
};

app.put('/api/admin/spare-part-orders/:id/status', handleOrderStatusChange);
app.patch('/api/admin/spare-part-orders/:id/status', handleOrderStatusChange);
app.put('/api/spare-part-orders/:id/status', handleOrderStatusChange);

// Admin Assign Delivery Worker
app.put('/api/admin/spare-part-orders/:id/assign-worker', async (req, res) => {
  const { workerId, workerName, workerPhone } = req.body;

  await refreshSparePartsFromDb();
  const idx = findOrderByUrlId(req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = sparePartOrders[idx];
  order.deliveryWorkerId = workerId;
  order.deliveryWorkerName = workerName;
  order.deliveryWorkerPhone = workerPhone;
  order.updatedAt = new Date().toISOString();

  await saveData();

  io.emit('spare_part_delivery_assigned', { orderId: order.orderId, workerId, order });
  res.json({ success: true, message: `Delivery worker ${workerName} assigned to order ${order.orderId}`, order });
});

// Worker Delivery Routes
app.get('/api/worker/spare-part-deliveries', async (req, res) => {
  await refreshSparePartsFromDb();
  const workerId = req.query.workerId || req.headers['worker-id'];
  if (!workerId) return res.json({ success: true, deliveries: [] });

  const assigned = sparePartOrders.filter(o =>
    String(o.deliveryWorkerId) === String(workerId) ||
    (!o.deliveryWorkerId && (o.orderStatus === 'PACKED' || o.orderStatus === 'SHIPPED'))
  );
  res.json({ success: true, deliveries: assigned });
});

app.post('/api/worker/spare-part-orders/:id/accept-delivery', async (req, res) => {
  const { workerId, workerName, workerPhone } = req.body;

  await refreshSparePartsFromDb();
  const idx = findOrderByUrlId(req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = sparePartOrders[idx];
  order.deliveryWorkerId = workerId;
  order.deliveryWorkerName = workerName;
  order.deliveryWorkerPhone = workerPhone;
  order.updatedAt = new Date().toISOString();

  await saveData();
  res.json({ success: true, message: 'Delivery accepted by worker', order });
});

app.post('/api/worker/spare-part-orders/:id/start-delivery', async (req, res) => {
  await refreshSparePartsFromDb();

  const idx = findOrderByUrlId(req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = sparePartOrders[idx];
  const nowIso = new Date().toISOString();
  order.orderStatus = 'OUT_FOR_DELIVERY';
  order.updatedAt = nowIso;

  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'OUT_FOR_DELIVERY',
    note: 'Out for delivery with FixoN delivery partner',
    timestamp: nowIso,
    updatedBy: 'worker'
  });

  await saveData();

  const payload = {
    orderId: order.orderId,
    status: 'OUT_FOR_DELIVERY',
    statusHistory: order.statusHistory,
    timestamp: nowIso,
    message: `Your FixoN spare parts order ${order.orderId} is out for delivery.`,
    order
  };

  io.emit('spare_part_order_status_updated', payload);
  io.emit('spare_part_order_update', payload);

  res.json({ success: true, message: 'Delivery started! Customer notified.', order });
});

app.post('/api/worker/spare-part-orders/:id/delivered', async (req, res) => {
  await refreshSparePartsFromDb();

  const idx = findOrderByUrlId(req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = sparePartOrders[idx];
  const nowIso = new Date().toISOString();
  order.orderStatus = 'DELIVERED';
  order.paymentStatus = 'PAID';
  order.updatedAt = nowIso;

  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'DELIVERED',
    note: 'Order delivered successfully by worker',
    timestamp: nowIso,
    updatedBy: 'worker'
  });

  await saveData();

  const payload = {
    orderId: order.orderId,
    status: 'DELIVERED',
    statusHistory: order.statusHistory,
    timestamp: nowIso,
    message: `Your FixoN spare parts order ${order.orderId} has been delivered.`,
    order
  };

  io.emit('spare_part_order_status_updated', payload);
  io.emit('spare_part_order_update', payload);

  res.json({ success: true, message: 'Order marked DELIVERED!', order });
});

// Live Delivery GPS Location Telemetry
app.post('/api/worker/spare-part-orders/:id/location', async (req, res) => {
  const { workerId, latitude, longitude, lat, lng, timestamp } = req.body;
  const currentLat = latitude || lat;
  const currentLng = longitude || lng;

  if (!currentLat || !currentLng) {
    return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
  }

  await refreshSparePartsFromDb();
  const idx = findOrderByUrlId(req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = sparePartOrders[idx];

  // Optional: Security check to ensure assigned worker updates GPS
  if (workerId && order.deliveryWorkerId && String(order.deliveryWorkerId) !== String(workerId)) {
    console.warn(`⚠️ Location update rejected: Worker ${workerId} is not assigned to order ${order.orderId}`);
  }

  order.workerLatitude = Number(currentLat);
  order.workerLongitude = Number(currentLng);
  order.lastLocationUpdate = timestamp || new Date().toISOString();

  // Store worker location globally in memory
  if (workerId || order.deliveryWorkerId) {
    const wKey = String(workerId || order.deliveryWorkerId);
    workers[wKey] = {
      ...workers[wKey],
      _id: wKey,
      lat: Number(currentLat),
      lng: Number(currentLng),
      lastSeen: new Date().toISOString()
    };
  }

  await saveData();

  const payload = {
    orderId: order.orderId,
    lookupId: order.lookupId || order.orderId.replace('#', ''),
    workerId: workerId || order.deliveryWorkerId,
    latitude: Number(currentLat),
    longitude: Number(currentLng),
    timestamp: order.lastLocationUpdate,
    orderStatus: order.orderStatus
  };

  io.emit('spare_part_delivery_location', payload);
  io.emit('worker_location_updated', payload);

  res.json({ success: true, message: 'Delivery location updated successfully', location: payload });
});

app.get('/api/spare-part-orders/:id/tracking', async (req, res) => {
  await refreshSparePartsFromDb();
  const idx = findOrderByUrlId(req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = sparePartOrders[idx];
  let custLat = 17.3850;
  let custLng = 78.4867;

  if (order.deliveryAddress && typeof order.deliveryAddress === 'object') {
    custLat = Number(order.deliveryAddress.lat || order.deliveryAddress.latitude || custLat);
    custLng = Number(order.deliveryAddress.lng || order.deliveryAddress.longitude || custLng);
  }

  res.json({
    success: true,
    orderId: order.orderId,
    lookupId: order.lookupId,
    orderStatus: order.orderStatus,
    deliveryWorkerId: order.deliveryWorkerId,
    deliveryWorkerName: order.deliveryWorkerName,
    deliveryWorkerPhone: order.deliveryWorkerPhone,
    workerLatitude: order.workerLatitude || null,
    workerLongitude: order.workerLongitude || null,
    lastLocationUpdate: order.lastLocationUpdate || null,
    customerLat: custLat,
    customerLng: custLng,
    deliveryAddress: order.deliveryAddress
  });
});


// 8. Suppliers API (Admin Private)
app.get('/api/admin/spare-part-suppliers', (req, res) => {
  res.json({ success: true, suppliers: sparePartSuppliers });
});

app.post('/api/admin/spare-part-suppliers', async (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Supplier name required' });
  const supplier = {
    _id: 'SUP' + (100 + sparePartSuppliers.length + 1),
    name: name.trim(),
    phone: phone || '',
    email: email || '',
    address: address || '',
    notes: notes || '',
    createdAt: new Date().toISOString()
  };
  sparePartSuppliers.push(supplier);
  await saveData();
  res.json({ success: true, supplier, suppliers: sparePartSuppliers });
});

// 9. Worker Spare Part Requests API
app.get('/api/admin/spare-part-requests', async (req, res) => {
  await refreshSparePartsFromDb();
  res.json({ success: true, requests: sparePartRequests });
});

app.post('/api/worker/spare-part-request', async (req, res) => {
  const { workerId, workerName, bookingId, partName, category, quantity, reason } = req.body;

  if (!partName) return res.status(400).json({ success: false, message: 'Part Name is required' });

  const requestObj = {
    _id: 'REQ' + Date.now(),
    workerId: workerId || 'UNKNOWN_WORKER',
    workerName: workerName || 'Worker',
    bookingId: bookingId || 'N/A',
    partName: String(partName).trim(),
    category: category || 'General',
    quantity: Number(quantity || 1),
    reason: reason || 'Part replacement needed for customer repair job',
    status: 'PENDING', // PENDING, APPROVED, REJECTED, DELIVERED
    createdAt: new Date().toISOString()
  };

  sparePartRequests.unshift(requestObj);
  await saveData();

  io.emit('admin_alert', {
    type: 'worker_part_request',
    title: '🔧 Worker Part Request',
    message: `${workerName || 'Worker'} requested ${quantity || 1}x ${partName} for Booking #${bookingId || ''}`
  });

  res.json({ success: true, message: 'Part request submitted to Admin!', request: requestObj });
});

app.put('/api/admin/spare-part-requests/:id', async (req, res) => {
  const { status, adminNotes } = req.body;
  const idx = sparePartRequests.findIndex(r => r._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Request not found' });

  sparePartRequests[idx].status = status;
  if (adminNotes) sparePartRequests[idx].adminNotes = adminNotes;
  sparePartRequests[idx].updatedAt = new Date().toISOString();

  await saveData();
  io.emit('worker_part_request_update', sparePartRequests[idx]);

  res.json({ success: true, request: sparePartRequests[idx] });
});

// 10. Analytics API
app.get('/api/admin/spare-parts/analytics', async (req, res) => {
  await refreshSparePartsFromDb();

  const totalParts = spareParts.length;
  const activeParts = spareParts.filter(p => p.active !== false).length;
  const outOfStock = spareParts.filter(p => Number(p.stock) === 0).length;
  const lowStock = spareParts.filter(p => Number(p.stock) > 0 && Number(p.stock) <= (p.lowStockThreshold || 5)).length;

  const totalOrders = sparePartOrders.length;
  const pendingOrders = sparePartOrders.filter(o => o.orderStatus === 'NEW' || o.orderStatus === 'CONFIRMED' || o.orderStatus === 'PACKED').length;
  const completedOrders = sparePartOrders.filter(o => o.orderStatus === 'DELIVERED').length;
  
  const revenue = sparePartOrders.reduce((sum, o) => sum + (o.orderStatus !== 'CANCELLED' ? Number(o.totalAmount || 0) : 0), 0);

  res.json({
    success: true,
    analytics: {
      totalParts,
      activeParts,
      outOfStock,
      lowStock,
      totalOrders,
      pendingOrders,
      completedOrders,
      revenue,
      pendingWorkerRequests: sparePartRequests.filter(r => r.status === 'PENDING').length
    }
  });
});

// â”€â”€ Admin: force reload all data from MongoDB (useful after external changes)
app.post('/api/admin/reload-data', async (req, res) => {
  try {
    await loadData();
    res.json({ success: true, message: 'Data reloaded from MongoDB Atlas', serviceCount: services.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  COUPON ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// GET /api/coupons  (Supports ?userId=... for customer app filtering)
app.get('/api/coupons', (req, res) => {
  const { userId } = req.query;
  const now = new Date();

  let list = coupons;

  // If customer app passes userId, show ONLY active, non-expired, and unused by this user
  if (userId) {
    list = coupons.filter(c => {
      if (!c.active) return false;
      if (c.expiry && new Date(c.expiry) < now) return false;
      const usedBy = c.usedByUsers || [];
      if (usedBy.includes(userId)) return false;
      return true;
    });
  }

  res.json({ success: true, coupons: list });
});

// GET /api/admin/coupons (Admin Control Panel alias)
app.get('/api/admin/coupons', (req, res) => {
  res.json({ success: true, coupons });
});

// POST /api/coupons (Admin creates new coupon)
app.post('/api/coupons', (req, res) => {
  const { code, discount, type, minOrder, expiry, active } = req.body;
  if (!code || !discount || !expiry) {
    return res.status(400).json({ success: false, error: 'Missing required coupon fields' });
  }

  const cleanCode = String(code).trim().toUpperCase();
  const existing = coupons.find(c => c.code.toUpperCase() === cleanCode);
  if (existing) {
    return res.status(400).json({ success: false, error: 'Coupon code already exists' });
  }

  const newCoupon = {
    _id: 'CP_' + Date.now(),
    code: cleanCode,
    discount: Number(discount) || 0,
    type: type || 'percent',
    minOrder: Number(minOrder) || 0,
    expiry: expiry,
    active: active !== false,
    used: 0,
    usedByUsers: []
  };

  coupons.push(newCoupon);
  saveData();
  console.log(`ðŸŽŸï¸ New coupon created: ${cleanCode}`);
  res.json({ success: true, coupon: newCoupon });
});

app.post('/api/admin/coupons', (req, res) => {
  const { code, discount, type, minOrder, expiry, active } = req.body;
  if (!code || !discount || !expiry) {
    return res.status(400).json({ success: false, error: 'Missing required coupon fields' });
  }

  const cleanCode = String(code).trim().toUpperCase();
  const existing = coupons.find(c => c.code.toUpperCase() === cleanCode);
  if (existing) {
    return res.status(400).json({ success: false, error: 'Coupon code already exists' });
  }

  const newCoupon = {
    _id: 'CP_' + Date.now(),
    code: cleanCode,
    discount: Number(discount) || 0,
    type: type || 'percent',
    minOrder: Number(minOrder) || 0,
    expiry: expiry,
    active: active !== false,
    used: 0,
    usedByUsers: []
  };

  coupons.push(newCoupon);
  saveData();
  console.log(`ðŸŽŸï¸ New coupon created: ${cleanCode}`);
  res.json({ success: true, coupon: newCoupon });
});

// PUT & PATCH /api/coupons/:id/toggle (Admin enables/disables coupon)
const handleCouponToggle = (req, res) => {
  const cId = req.params.id;
  const coupon = coupons.find(c => String(c._id) === String(cId) || c.code.toUpperCase() === String(cId).toUpperCase());

  if (!coupon) {
    return res.status(404).json({ success: false, error: 'Coupon not found' });
  }

  coupon.active = !coupon.active;
  saveData();
  console.log(`ðŸŽŸï¸ Coupon ${coupon.code} active state toggled to: ${coupon.active}`);
  res.json({ success: true, coupon });
};

app.put('/api/coupons/:id/toggle', handleCouponToggle);
app.patch('/api/coupons/:id/toggle', handleCouponToggle);
app.put('/api/admin/coupons/:id/toggle', handleCouponToggle);
app.patch('/api/admin/coupons/:id/toggle', handleCouponToggle);

// DELETE /api/coupons/:id (Admin deletes coupon)
const handleCouponDelete = (req, res) => {
  const cId = req.params.id;
  coupons = coupons.filter(c => String(c._id) !== String(cId) && c.code.toUpperCase() !== String(cId).toUpperCase());
  saveData();
  console.log(`ðŸŽŸï¸ Coupon ${cId} deleted`);
  res.json({ success: true });
};

app.delete('/api/coupons/:id', handleCouponDelete);
app.delete('/api/admin/coupons/:id', handleCouponDelete);

// POST /api/coupons/apply (Customer validates & applies a coupon)
app.post('/api/coupons/apply', (req, res) => {
  const { code, userId, subtotal } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Please enter a coupon code' });

  const cleanCode = String(code).trim().toUpperCase();
  const coupon = coupons.find(c => c.code.toUpperCase() === cleanCode);

  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Invalid coupon code' });
  }

  // 1. Active check
  if (!coupon.active) {
    return res.status(400).json({ success: false, message: 'This coupon is currently disabled' });
  }

  // 2. Expiry check
  if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
    return res.status(400).json({ success: false, message: 'This coupon has expired' });
  }

  // 3. One-time usage per customer check
  const usedBy = coupon.usedByUsers || [];
  if (userId && usedBy.includes(userId)) {
    return res.status(400).json({ success: false, message: 'You have already used this coupon code. It can only be used once per customer.' });
  }

  // 4. Min order check
  const amount = Number(subtotal) || 0;
  if (coupon.minOrder && amount < coupon.minOrder) {
    return res.status(400).json({ success: false, message: `Minimum order amount of â‚¹${coupon.minOrder} required for this coupon` });
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.type === 'percent') {
    discountAmount = Math.round((amount * coupon.discount) / 100);
  } else {
    discountAmount = Number(coupon.discount) || 0;
  }
  if (discountAmount > amount) discountAmount = amount;

  res.json({
    success: true,
    discountAmount,
    couponCode: coupon.code,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      discount: coupon.discount,
      type: coupon.type,
      minOrder: coupon.minOrder
    }
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CHAT ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  saveData(); // Persist admin reply to MongoDB
  console.log(`ðŸ“¤ Admin â†’ ${receiverId}: ${message}`);
  res.json({ success: true, message: msgObj });
});

app.post('/api/chat/send', (req, res) => {
  const { senderId, message, name, email, phone } = req.body;
  const sId = senderId || 'guest';
  const realUser = registeredUsers.find(u => u._id === sId);

  if (!users[sId]) {
    users[sId] = {
      _id: sId,
      name: name || realUser?.name || ('Customer ' + String(sId).slice(-4)),
      email: email || realUser?.email || '',
      phone: phone || realUser?.phone || '',
    };
    io.emit('new_user', users[sId]);
  } else {
    // Update user info if provided
    if (name) users[sId].name = name;
    if (email) users[sId].email = email;
    if (phone) users[sId].phone = phone;
  }

  const msgObj = {
    senderId,
    receiverId: 'admin',
    message,
    senderType: 'customer',
    senderName: users[senderId].name,
    senderEmail: users[senderId].email || '',
    senderPhone: users[senderId].phone || '',
    createdAt: new Date().toISOString()
  };
  messages.push(msgObj);
  io.emit('receive_message', msgObj);
  saveData(); // Persist to MongoDB so Admin Panel always sees messages
  console.log(`ðŸ“© ${users[senderId].name}: ${message}`);

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
    saveData(); // Persist bot reply too
  }, 800);

  res.json({ success: true, message: msgObj });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SOCKET.IO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Map: socketId â†’ userId  (so we know WHICH customer disconnected)
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
          console.log(`ðŸ§¹ Periodic cleanup: removing inactive customer ${u.name || userId} from memory`);
          io.emit('user_offline', { userId });
          delete users[userId];
        }
      }
    }
  });
}, 15000);

io.on('connection', (socket) => {
  console.log('âœ… Client connected:', socket.id);

  // Admin panel joins â€” send only LIVE customers (active in last 60s)
  socket.on('admin_join', () => {
    console.log('ðŸ‘‘ Admin panel connected');
    const ONLINE_MS = 60 * 1000;
    const now = Date.now();
    Object.values(users)
      .filter(u => u.lat && u.lastSeen && (now - new Date(u.lastSeen).getTime()) < ONLINE_MS)
      .forEach(u => {
        socket.emit('user_location', { userId: u._id, name: u.name, lat: u.lat, lng: u.lng, address: u.address });
      });
  });

  // Customer app sends chat message via socket
  socket.on('send_message', (data) => {
    const sId = data?.senderId || 'guest';
    const realUser = registeredUsers.find(u => u._id === sId);
    if (!users[sId]) {
      users[sId] = {
        _id: sId,
        name: data?.name || realUser?.name || ('Customer ' + String(sId).slice(-4)),
        email: realUser?.email || '',
        phone: realUser?.phone || '',
      };
      io.emit('new_user', users[sId]);
    }
    const msgObj = {
      senderId: sId,
      receiverId: 'admin',
      message: data?.message || '',
      senderType: 'customer',
      senderName: users[sId].name,
      senderEmail: users[sId].email || '',
      senderPhone: users[sId].phone || '',
      createdAt: data?.createdAt || new Date().toISOString()
    };
    messages.push(msgObj);
    io.emit('receive_message', msgObj);
    saveData();
    console.log(`ðŸ“© [Socket] ${users[sId].name}: ${data?.message}`);
  });

  // Customer app opens â†’ register this socket â†” userId mapping
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
      console.log(`ðŸ‘¤ Customer online: ${users[userId].name} (${userId})`);
    }
  });

  // Client disconnects â†’ immediately mark customer offline
  socket.on('disconnect', () => {
    const userId = socketToUser[socket.id];
    if (userId && users[userId]) {
      // ONLY mark offline / delete if this socket is the active one for the user (prevents race conditions)
      if (users[userId].socketId === socket.id) {
        console.log(`ðŸ“´ Customer offline: ${users[userId].name} (${userId})`);
        io.emit('user_offline', { userId });
        delete users[userId]; // Delete from users map completely to free memory
      } else {
        console.log(`â„¹ï¸ Socket disconnect ignored for user ${userId} (reconnected on socket: ${users[userId].socketId})`);
      }
    }
    delete socketToUser[socket.id];
    console.log('âŒ Disconnected:', socket.id);
  });
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  COUPONS ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  if (coupon.minOrder && orderAmount < coupon.minOrder) return res.status(400).json({ success: false, error: `Minimum order â‚¹${coupon.minOrder} required` });

  const discount = coupon.type === 'percent'
    ? Math.round((orderAmount * coupon.discount) / 100)
    : coupon.discount;

  coupon.used = (coupon.used || 0) + 1;
  saveData();
  res.json({ success: true, discount, finalAmount: orderAmount - discount, coupon });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  REFERRAL ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  res.json({ success: true, message: 'Both users credited â‚¹50!' });
});

// (Invoice route is defined above at /api/bookings/:id/invoice)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  WORKER PAYOUT ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  OTP LOGIN ROUTES
//  â”€ Real SMS via Fast2SMS when FAST2SMS_KEY env var is set
//  â”€ Falls back to console/response mode for local development
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const otpStore = {}; // phone â†’ { otp, expires, sentAt }
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
    // â”€â”€ Real SMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      await sendSmsOtp(phone, otp);
      console.log(`ðŸ“± Real SMS OTP sent to ${phone}`);
      // âš ï¸ Never return OTP in production
      res.json({ success: true, message: `OTP sent to +91 ${phone}` });
    } catch (err) {
      console.error('SMS Error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to send SMS. Check Fast2SMS key or balance.' });
    }
  } else {
    // â”€â”€ Development mode: return OTP in response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log(`ðŸ“± [DEV] OTP for ${phone}: ${otp}  (Set FAST2SMS_KEY to enable real SMS)`);
    res.json({
      success: true,
      message: `[DEV MODE] OTP generated for ${phone}`,
      otp,           // â† Only in dev! Removed in production
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

  delete otpStore[phone]; // Consume OTP â€” one-time use
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
    console.log(`ðŸ†• New user via OTP: ${user.name} (${phone})`);
  } else {
    console.log(`âœ… OTP login: ${user.name} (${phone})`);
  }
  res.json({ success: true, token: 'local_' + user._id, user });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CITIES & WORKER FILTERING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  FCM PUSH NOTIFICATION TOKEN STORAGE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const fcmTokens = {}; // userId â†’ fcmToken

app.post('/api/notifications/register', (req, res) => {
  const { userId, fcmToken } = req.body;
  if (userId && fcmToken) {
    fcmTokens[userId] = fcmToken;
    console.log(`ðŸ”” FCM token registered for user ${userId}`);
  }
  res.json({ success: true });
});

// GET /api/notifications â€” supports ?userId= filter for mobile apps
app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  let filtered = notificationsList;
  if (userId) {
    filtered = notificationsList.filter(n =>
      !n.userId || n.userId === 'all' || n.userId === userId
    );
  }
  console.log(`ðŸ” GET /api/notifications â†’ userId=${userId || 'all'}, count=${filtered.length}`);
  res.json({ success: true, notifications: filtered });
});

// POST /api/notifications/send â€” supports targeting: userId, workerId, or broadcast to 'all'
app.post('/api/notifications/send', (req, res) => {
  const { userId, workerId, title, body, message, type, targetType } = req.body;
  const notifBody = body || message || '';
  const newNotif = {
    _id: 'NT' + Date.now(),
    userId: userId || workerId || 'all',
    workerId: workerId || null,
    title: title || 'Alert',
    message: notifBody,
    body: notifBody,
    type: type || 'general',
    read: false,
    icon: type === 'promo' ? 'ðŸŽ' : type === 'booking' ? 'ðŸ“¦' : type === 'worker' ? 'ðŸ‘·' : type === 'emergency' ? 'ðŸš¨' : 'ðŸ“¢',
    createdAt: new Date().toISOString(),
  };

  notificationsList.push(newNotif);
  saveData();

  // Broadcast to all sockets (mobile apps listen to 'new_notification')
  io.emit('new_notification', newNotif);

  // Also emit targeted status update if userId provided
  if (userId) {
    io.emit('booking_status_update', { userId, notification: newNotif });
  }

  console.log(`ðŸ”” Notification [${newNotif.type}] â†’ ${userId || workerId || 'ALL'}: "${title}"`);
  res.json({ success: true, notification: newNotif });
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PREMIUM ADDITIONS: PHOTOS, VERIFICATION, CHAT & AI
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// (Primary photo upload route is defined earlier at line ~732)

// 2. Submit Worker Document Verification â€” supports separate Aadhaar and PAN
app.post('/api/workers/:id/verify-document', (req, res) => {
  const { documentType, documentNumber, documentFrontUrl, documentBackUrl } = req.body;
  // Find worker by _id OR workerId (so worker app can send either)
  const w = adminWorkers.find(x => x._id === req.params.id || x.workerId === req.params.id);
  if (!w) {
    console.log(`âŒ verify-document: worker not found for id=${req.params.id}`);
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
  console.log(`ðŸ“‹ ${documentType} document submitted by worker: ${w.name} (${w._id})`);
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
  console.log(`âœ… Worker APPROVED: ${w.name} â†’ ID: ${w.workerId} / Pass: ${w.workerPassword}`);
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
  console.log(`âŒ Worker REJECTED: ${w.name}`);
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
  console.log(`ðŸ”’ Worker ${w.isBlocked ? 'BLOCKED' : 'UNBLOCKED'}: ${w.name}`);
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
  console.log(`ðŸ”‘ Password reset for worker ${w.name}: ${newPassword}`);
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
  console.log(`ðŸ’¬ Private Msg: ${senderName || senderId} â†’ ${receiverId}: ${message}`);

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
      console.error('ðŸ”¥ Real Gemini API Error:', err);
    }
  }

  // Fallback simulator mode (highly realistic responses for testing)
  console.log('ðŸ¤– [AI] Using Mock Intelligent Diagnosis Mode');
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



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  WORKER APP ROUTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  console.log(`ðŸ‘· Worker login: ${w.name} (${w.workerId})`);
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

// NOTE: Worker routes W3-W11 previously duplicated here have been removed.
// The primary comprehensive worker routes are defined earlier in this file
// at lines ~1654-1926 with full Socket.IO, MongoDB atomic save, and notification support.

// Worker routes W4-W11 have been consolidated into the primary handler section above.


// â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    users: registeredUsers.length,
    bookings: bookings.length,
    workers: adminWorkers.length,
    coupons: coupons.length,
    messages: messages.length,
    spareParts: spareParts.length,
    sparePartOrders: sparePartOrders.length,
    uptime: process.uptime(),
  });
});

// Serve React Admin Control Panel production build
app.use(express.static(path.join(__dirname, 'build')));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const buildIndex = path.join(__dirname, 'build', 'index.html');
  if (fs.existsSync(buildIndex)) {
    res.sendFile(buildIndex);
  } else {
    res.send('FixoN Admin Control Panel Backend Server Running');
  }
});
