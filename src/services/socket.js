import { io } from 'socket.io-client';

const CLOUD = 'https://fixon-backend.onrender.com';
const LOCAL = 'http://localhost:5000';

const isDev = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:' ||
  (navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron'))
);

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

  // Forward all incoming real-time events to registered listeners
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

  events.forEach(evt => {
    s.on(evt, (data) => {
      console.log(`📡 [Socket ${name}] Event: ${evt}`, data);
      if (listeners[evt]) {
        listeners[evt].forEach(fn => fn(data));
      }
    });
  });
}

export const connectSocket = () => {
  if (!cloudSocket) {
    cloudSocket = io(CLOUD, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 99
    });
    setupSocket(cloudSocket, 'Cloud');
  }

  if (isDev && !localSocket) {
    try {
      localSocket = io(LOCAL, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 99
      });
      setupSocket(localSocket, 'Local');
    } catch (e) {
      console.error('Failed to init local socket:', e);
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
      if (cloudSocket && cloudSocket.connected) cloudSocket.emit(evt, data);
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
