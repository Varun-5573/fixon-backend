import React, { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

export default function ChatPage({ socket }) {
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState({});  // { userId: count }
  const endRef = useRef(null);
  const activeRef = useRef(null); // keep latest active user without re-subscribing socket

  // Keep activeRef in sync
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => { loadAllMessages(); }, []);

  // Auto-refresh every 5s to catch messages even when socket drops
  useEffect(() => {
    const interval = setInterval(() => { loadAllMessages(true); }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (active) { filterMessages(active._id); clearUnread(active._id); } }, [active, allMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Real-time incoming messages using activeRef
  useEffect(() => {
    if (socket) {
      const handleReceiveMessage = (msg) => {
        setAllMessages(prev => [...prev, msg]);
        const currentActive = activeRef.current;
        const msgSender = String(msg.senderId || '');
        const msgReceiver = String(msg.receiverId || '');
        const activeId = currentActive ? String(currentActive._id) : '';

        if (activeId && (msgSender === activeId || msgReceiver === activeId)) {
          setMessages(p => [...p, msg]);
        } else if (msg.senderType === 'customer') {
          const sId = msgSender;
          setUnread(p => ({ ...p, [sId]: (p[sId] || 0) + 1 }));
          setUsers(prev => {
            if (prev.find(u => String(u._id) === sId)) return prev;
            return [...prev, { _id: sId, name: msg.senderName || ('Customer ' + sId.slice(-4)), online: true }];
          });
          toast(`💬 New message from ${msg.senderName || 'Customer'}`, { duration: 3000 });
        }
      };

      const handleNewUser = (user) => {
        setUsers(p => {
          if (p.find(u => String(u._id) === String(user._id))) return p;
          return [...p, user];
        });
        toast(`👤 New customer joined: ${user.name}`);
      };

      socket.on('receive_message', handleReceiveMessage);
      socket.on('new_user', handleNewUser);

      return () => {
        socket.off('receive_message', handleReceiveMessage);
        socket.off('new_user', handleNewUser);
      };
    }
  }, [socket]);

  const clearUnread = (id) => setUnread(p => ({ ...p, [id]: 0 }));

  // Load all messages and extract unique chat users from them
  const loadAllMessages = async (silent = false) => {
    try {
      const r = await adminApi.getMessages();
      const msgs = r.messages || r || [];
      setAllMessages(msgs);

      const userMap = new Map();

      // 1. Add all registered users to userMap
      try {
        const ur = await adminApi.getUsers();
        (ur.users || []).forEach(u => {
          if (u._id) {
            userMap.set(u._id, {
              _id: u._id,
              name: u.name || ('Customer ' + String(u._id).slice(-4)),
              email: u.email || '',
              phone: u.phone || '',
              online: !!u.isOnline,
            });
          }
        });
      } catch {}

      // 2. Also extract senders/receivers from messages
      msgs.forEach(m => {
        const cId = m.senderType === 'customer' ? m.senderId : (m.receiverId !== 'admin' ? m.receiverId : m.senderId);
        if (cId && cId !== 'admin' && cId !== 'bot') {
          if (!userMap.has(cId)) {
            userMap.set(cId, {
              _id: cId,
              name: m.senderName || ('Customer ' + String(cId).slice(-4)),
              email: m.senderEmail || '',
              phone: m.senderPhone || '',
              online: false,
            });
          } else {
            const existing = userMap.get(cId);
            if (m.senderName && existing.name.startsWith('Customer')) existing.name = m.senderName;
            if (m.senderEmail && !existing.email) existing.email = m.senderEmail;
            if (m.senderPhone && !existing.phone) existing.phone = m.senderPhone;
          }
        }
      });

      const userList = Array.from(userMap.values());
      if (userList.length > 0) {
        setUsers(userList);
        if (!activeRef.current) {
          setActive(userList[0]);
        }
      }

      // Auto-refresh active conversation if one is open
      const currentActive = activeRef.current;
      if (currentActive) {
        const targetId = String(currentActive._id);
        setMessages(msgs.filter(m =>
          String(m.senderId) === targetId ||
          String(m.receiverId) === targetId ||
          (m.senderType === 'bot' && String(m.receiverId) === targetId)
        ));
      }
    } catch {}
  };

  const filterMessages = (userId) => {
    if (!userId) return;
    const targetId = String(userId);
    setMessages(allMessages.filter(m =>
      String(m.senderId) === targetId ||
      String(m.receiverId) === targetId ||
      (m.senderType === 'bot' && String(m.receiverId) === targetId)
    ));
  };

  const send = async () => {
    if (!text.trim() || !active) return;
    try {
      await adminApi.sendMessage({ receiverId: active._id, message: text, senderType: 'admin' });
      const newMsg = { senderId: 'admin', message: text, senderType: 'admin', createdAt: new Date() };
      setMessages(p => [...p, newMsg]);
      setAllMessages(p => [...p, newMsg]);
      setText('');
    } catch { toast.error('Failed to send'); }
  };

  return (
    <div>
      <div className="page-hero">
        <div>
          <h2 className="page-hero-title">Live <span className="gradient-text">Support Chat</span></h2>
          <div className="page-hero-sub"><span className="live-dot" />Real-time customer messaging</div>
        </div>
      </div>

      <div className="chat-layout">
        {/* User List */}
        <div className="chat-list">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            💬 Conversations
            {Object.values(unread).some(v => v > 0) && (
              <span style={{ background: 'var(--error)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>
                {Object.values(unread).reduce((a, b) => a + b, 0)} NEW
              </span>
            )}
          </div>
          {users.map((u, i) => (
            <div key={u._id} className={`chat-item ${active?._id === u._id ? 'active' : ''}`}
              onClick={() => setActive(u)}
              style={{ animationDelay: `${i * 40}ms`, position: 'relative' }}>
              <div className="chat-avatar" style={{ position: 'relative' }}>
                {(u.name || 'U')[0]}
                {unread[u._id] > 0 && (
                  <div style={{
                    position: 'absolute', top: -4, right: -4,
                    background: 'var(--error)', color: '#fff',
                    fontSize: 9, fontWeight: 800,
                    width: 16, height: 16, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--card)',
                  }}>{unread[u._id]}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {u.name || 'Customer'}
                  <span style={{ fontSize: 10, color: 'var(--text-sub)', fontWeight: 400, marginLeft: 4 }}>
                    (#{u._id?.slice(-4)})
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.phone ? `📱 ${u.phone}` : u.email ? `📧 ${u.email}` : `🆔 ${u._id}`}
                </div>
              </div>
              {unread[u._id] > 0 && (
                <span style={{ color: 'var(--error)', fontSize: 11, fontWeight: 800 }}>●</span>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-sub)', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💤</div>
              No customers yet.<br />Waiting for connections…
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="chat-window">
          {active ? (
            <>
              {/* Chat Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(124,58,237,0.04)' }}>
                <div className="chat-avatar">{(active.name || 'U')[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{active.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="live-dot" style={{ marginRight: 4 }} />Customer
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                  📧 {active.email}
                </div>
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                    <div>No messages yet. The customer will message you here.</div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.senderType === 'admin' ? 'flex-end' : 'flex-start' }}>
                    {m.senderType === 'bot' && (
                      <div style={{ fontSize: 10, color: 'var(--secondary)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🤖 AI Chatbot
                      </div>
                    )}
                    {m.senderType === 'admin' && (
                      <div style={{ fontSize: 10, color: 'var(--primary)', marginBottom: 3 }}>👑 You (Admin)</div>
                    )}
                    <div className={`chat-bubble ${m.senderType === 'admin' ? 'sent' : m.senderType === 'bot' ? 'bot' : 'received'}`}>
                      {m.message}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, marginLeft: 4, marginRight: 4 }}>
                      {new Date(m.createdAt || Date.now()).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div className="chat-input-bar">
                <input className="input" placeholder="Reply to customer..." value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()} />
                <button className="chat-send-btn" onClick={send}>➤</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: 'var(--text-sub)' }}>
              <div style={{ fontSize: 60 }}>💬</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Select a conversation</div>
              <div style={{ fontSize: 13 }}>Customer messages appear here in real-time</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
