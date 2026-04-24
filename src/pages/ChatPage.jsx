import React, { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

export default function ChatPage({ socket }) {
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState({});  // { userId: count }
  const endRef = useRef(null);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { if (active) { loadMessages(active._id); clearUnread(active._id); } }, [active]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Real-time incoming messages
  useEffect(() => {
    if (socket) {
      socket.on('receive_message', (msg) => {
        if (active && (msg.senderId === active._id || msg.receiverId === active._id)) {
          setMessages(p => [...p, msg]);
        } else {
          // Increment unread for that user
          if (msg.senderType === 'customer') {
            setUnread(p => ({ ...p, [msg.senderId]: (p[msg.senderId] || 0) + 1 }));
            toast(`💬 New message from ${msg.senderId}`, { duration: 3000 });
          }
        }
      });
      socket.on('new_user', (user) => {
        setUsers(p => {
          if (p.find(u => u._id === user._id)) return p;
          return [...p, user];
        });
        toast(`👤 New customer joined: ${user.name}`);
      });
    }
    return () => { socket?.off('receive_message'); socket?.off('new_user'); };
  }, [socket, active]);

  const clearUnread = (id) => setUnread(p => ({ ...p, [id]: 0 }));

  const loadUsers = async () => {
    try { const r = await adminApi.getUsers(); setUsers(r.users || r || []); }
    catch {}
  };

  const loadMessages = async (userId) => {
    try {
      const r = await adminApi.getMessages();
      setMessages((r.messages || r || []).filter(m =>
        m.senderId === userId || m.receiverId === userId || m.senderType === 'bot'
      ));
    }
    catch { setMessages([]); }
  };

  const send = async () => {
    if (!text.trim() || !active) return;
    try {
      await adminApi.sendMessage({ receiverId: active._id, message: text, senderType: 'admin' });
      setMessages(p => [...p, { senderId: 'admin', message: text, senderType: 'admin', createdAt: new Date() }]);
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
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
