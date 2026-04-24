import { io } from 'socket.io-client';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
let socket = null;

export const connectSocket = () => {
  if (!socket || !socket.connected) {
    socket = io(BASE, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10 });
    socket.on('connect', () => { console.log('✅ Socket connected'); socket.emit('admin_join'); });
    socket.on('disconnect', () => console.log('❌ Socket disconnected'));
    socket.on('connect_error', (e) => console.log('Socket error:', e.message));
  }
  return socket;
};

export const disconnectSocket = () => { if (socket) { socket.disconnect(); socket = null; } };
export const getSocket = () => socket;
