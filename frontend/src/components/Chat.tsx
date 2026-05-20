import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Search, MoreVertical, LogOut, Moon, Sun, Menu, Smile, Paperclip, Mic, CheckCheck } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { encryptMessage, decryptMessage } from '../utils/crypto';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

interface Message {
  id: string;
  content: string;
  iv: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  publicKey: string;
}

const Chat: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<(Message & { decryptedText?: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const messagesListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle('light-theme', !isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    // Fetch users
    axios.get(`${BACKEND_URL}/api/auth/users`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUsers(res.data.filter((u: User) => u.id !== user?.id));
    }).catch(console.error);

    // Setup Socket
    const newSocket = io(BACKEND_URL, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('receive_message', async (data: Message) => {
      if (selectedUser && (data.senderId === selectedUser.id || data.receiverId === selectedUser.id)) {
        const decryptedText = await decryptMessage(data.content, data.iv, user!.id, selectedUser.id);
        setMessages(prev => [...prev, { ...data, decryptedText }]);
      }
    });

    newSocket.on('message_sent_confirm', async (data: Message) => {
      if (selectedUser && data.receiverId === selectedUser.id) {
        const decryptedText = await decryptMessage(data.content, data.iv, user!.id, selectedUser.id);
        setMessages(prev => [...prev, { ...data, decryptedText }]);
      }
    });

    newSocket.on('chat_history', async (history: Message[]) => {
      if (!selectedUser) return;
      const decryptedHistory = await Promise.all(history.map(async (msg) => {
        const otherId = msg.senderId === user!.id ? msg.receiverId : msg.senderId;
        const decryptedText = await decryptMessage(msg.content, msg.iv, user!.id, otherId);
        return { ...msg, decryptedText };
      }));
      setMessages(decryptedHistory);
    });

    return () => {
      newSocket.close();
    };
  }, [token, user?.id, selectedUser]);

  useEffect(() => {
    if (socket && selectedUser) {
      socket.emit('get_messages', { withUserId: selectedUser.id });
    }
  }, [selectedUser, socket]);

  useEffect(() => {
    const messagesList = messagesListRef.current;
    if (!messagesList) return;

    messagesList.scrollTo({
      top: messagesList.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser || !socket || !user) return;

    const { encrypted, iv } = await encryptMessage(inputText, user.id, selectedUser.id);
    
    socket.emit('send_message', {
      receiverId: selectedUser.id,
      encryptedContent: encrypted,
      iv: iv
    });

    setInputText('');
  };

  return (
    <div className="app-container">
      <aside className={`sidebar ${showSidebar ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon"><Shield size={20} /></div>
            <div>
              <div className="brand-name">SecureChat</div>
            </div>
          </div>
          <div className="sidebar-controls">
            <button
              type="button"
              onClick={() => setIsDarkMode(prev => !prev)}
              className="icon-button"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              type="button"
              onClick={() => setShowSidebar(false)}
              className="icon-button"
              aria-label="Hide users list"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="icon-button"
              aria-label="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

            <div className="search-bar">
              <Search size={18} />
              <input
                type="text"
            placeholder="Search secure contacts..."
            aria-label="Search users"
          />
        </div>

        <div className="user-list">
          {users.map(u => (
            <div
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={`user-card ${selectedUser?.id === u.id ? 'active' : ''}`}
            >
              <div className="user-card-avatar">
                {u.username[0].toUpperCase()}
              </div>
              <div className="user-card-content">
                <div className="user-name">{u.username}</div>
              </div>
              <span className="user-dot" />
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-area">
        {selectedUser ? (
          <>
            <header className="chat-header">
              <div className="chat-topbar">
                <div className="chat-user-info">
                  <div className="user-avatar-large">
                    {selectedUser.username[0].toUpperCase()}
                  </div>
                <div>
                  <div className="user-name">{selectedUser.username}</div>
                  <div className="status-line">
                    <span className="status-dot online" /> Online
                  </div>
                </div>
              </div>

                <div className="chat-header-actions">
                  {!showSidebar && (
                    <button
                      type="button"
                      onClick={() => setShowSidebar(true)}
                      className="icon-button"
                      aria-label="Show users list"
                    >
                      <Menu size={18} />
                    </button>
                  )}
                  <button type="button" className="icon-button" aria-label="Conversation actions">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>

            </header>

            <div className="chat-messages-wrapper">
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <div className="empty-avatar"><Shield size={48} /></div>
                  <div>
                    <h2>Welcome to secure messaging</h2>
                    <p>Start the conversation with {selectedUser.username} and keep every message protected.</p>
                  </div>
                </div>
              ) : null}

              <div className="messages-list" ref={messagesListRef}>
                {messages.map((msg) => (
                  <div key={msg.id} className={`message-bubble ${msg.senderId === user?.id ? 'sent' : 'received'} ${!msg.decryptedText ? 'decrypt-failed' : ''}`}>
                    <div className="message-content">{msg.decryptedText || 'Encrypted payload unavailable'}</div>
                    <div className="message-meta">
                      <span className="message-time">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.senderId === user?.id && (
                        <span className="message-status">
                          <CheckCheck size={14} /> Delivered
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form className="input-area" onSubmit={handleSendMessage}>
              <div className="input-actions input-left">
                <button type="button" className="input-action-button" aria-label="Insert emoji">
                  <Smile size={18} />
                </button>
                <button type="button" className="input-action-button" aria-label="Attach file">
                  <Paperclip size={18} />
                </button>
              </div>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${selectedUser.username} securely...`}
              />

              <div className="input-actions input-right">
                <button type="button" className="input-action-button" aria-label="Record audio">
                  <Mic size={18} />
                </button>
                <button type="submit" className="send-button" aria-label="Send message">
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="chat-empty-state no-user-selected">
            <div className="empty-avatar"><Shield size={64} /></div>
            <h2>Select a user to start a secure chat</h2>
            {!showSidebar && (
              <button type="button" className="show-users-button" onClick={() => setShowSidebar(true)}>
                Show Users
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Chat;
