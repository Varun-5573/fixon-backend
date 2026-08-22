import { io } from 'socket.io-client';

// ══════════════════════════════════════════════════════════════
//  PRODUCTION SOCKET — Railway backend (always-on, no laptop required)
// ══════════════════════════════════════════════════════════════
const PRODUCTION_URL = 'https://fixon-backend.onrender.com';

const isDev = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:' ||
  (navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron'))
);

// In local Electron dev → connect to localhost:5000 AND Railway
// In production (non-Electron) → connect ONLY to Railway
const CLOUD_URL = PRODUCTION_URL;
const LOCAL_URL = 'http://localhost:5000';

let cloudSocket = null;
let localSocket = null;
const listeners = {};

function setupSocket(s, name) {
  s.on('connect', () => {
    console.log(`✅ [Socket ${name}] Connected (id: ${s.id})`);
    s.emit('admin_join');
  });

  s.on('disconnect', (reason) => {
    console.log(`❌ [Socket ${name}] Disconnected: ${reason}`);
  });

  s.on('connect_error', (e) => {
    console.log(`⚠️ [Socket ${name}] Connect error: ${e.message}`);
  });

  // Forward all incoming real-time events to registered listeners with deduplication
  const events = [
    'new_booking',
    'booking_update',
    'user_location',
    'user_offline',
    'payment_success',
    'user_join',
    'new_user',
    'worker_location',
    'new_notification'
  ];

  const recentEvents = new Set();

  events.forEach(evt => {
    s.on(evt, (data) => {
      // Create event key for deduplication across dual sockets
      const entityId = data?._id || data?.bookingId || data?.id || data?.userId || '';
      const statusKey = data?.status || data?.booking?.status || '';
      const eventKey = entityId ? `${evt}:${entityId}:${statusKey}` : `${evt}:${JSON.stringify(data)}`;
      if (recentEvents.has(eventKey)) return; // Skip duplicate from second socket
      recentEvents.add(eventKey);
      setTimeout(() => recentEvents.delete(eventKey), 800);

      console.log(`📡 [Socket ${name}] Event: ${evt}`, data);
      if (listeners[evt]) {
        listeners[evt].forEach(fn => fn(data));
      }
    });
  });
}

export const connectSocket = () => {
  // Always connect to Railway production backend
  if (!cloudSocket) {
    cloudSocket = io(CLOUD_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 99
    });
    setupSocket(cloudSocket, 'Railway');
  }

  // In local Electron dev ONLY: also connect to localhost for instant local updates
  if (isDev && !localSocket) {
    try {
      localSocket = io(LOCAL_URL, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10, // fewer retries for local — it may not be running
        timeout: 3000,
      });
      setupSocket(localSocket, 'Local');
    } catch (e) {
      console.log('ℹ️ Local socket not available (laptop server not running)');
    }
  }

  return {
    on: (evt, fn) => {
      if (!listeners[evt]) listeners[evt] = [];
      if (!listeners[evt].includes(fn)) listeners[evt].push(fn);
    },
    off: (evt, fn) => {
      if (listeners[evt]) {
        listeners[evt] = listeners[evt].filter(f => f !== fn);
      }
    },
    emit: (evt, data) => {
      // Always emit to Railway (production)
      if (cloudSocket && cloudSocket.connected) cloudSocket.emit(evt, data);
      // Also emit to local in dev if available
      if (localSocket && localSocket.connected) localSocket.emit(evt, data);
    }
  };
};

export const disconnectSocket = () => {
  if (cloudSocket) { cloudSocket.disconnect(); cloudSocket = null; }
  if (localSocket) { localSocket.disconnect(); localSocket = null; }
  Object.keys(listeners).forEach(k => delete listeners[k]);
};

export const getSocket = () => connectSocket();
