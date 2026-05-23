import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Search, MoreVertical, LogOut, Moon, Sun, Menu, Smile, Paperclip, Mic, Check, CheckCheck, ArrowLeft, VolumeX, Volume2, Ban, AlertTriangle, Settings, X, Camera } from 'lucide-react';
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
  delivered?: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  publicKey: string;
  phoneNumber?: string;
  description?: string;
  status?: string;
  avatarUrl?: string;
}

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
  '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
  '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
  '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
  '🤔', '🫣', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🫠',
  '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪',
  '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
  '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
  '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'
];

const Chat: React.FC = () => {
  const { user, token, logout, updateUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<(Message & { decryptedText?: string })[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [inputText, setInputText] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('online');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  const [showContactInfoModal, setShowContactInfoModal] = useState(false);

  const openSettings = () => {
    setEditUsername(user?.username || '');
    setEditEmail(user?.email || '');
    setEditPhone(user?.phoneNumber || '');
    setEditDesc(user?.description || '');
    setEditStatus(user?.status || 'online');
    setEditAvatarUrl(user?.avatarUrl || '');
    setShowSettingsModal(true);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedFields = {
      username: editUsername,
      email: editEmail,
      phoneNumber: editPhone,
      description: editDesc,
      status: editStatus,
      avatarUrl: editAvatarUrl
    };
    updateUser(updatedFields);

    // Save to global user profiles map in localStorage
    const savedProfiles = localStorage.getItem('global_user_profiles');
    const profilesMap = savedProfiles ? JSON.parse(savedProfiles) : {};
    profilesMap[user!.id] = updatedFields;
    localStorage.setItem('global_user_profiles', JSON.stringify(profilesMap));

    // Emit to other connected clients via Socket
    if (socket) {
      socket.emit('update_profile', {
        userId: user!.id,
        ...updatedFields
      });
    }
    setShowSettingsModal(false);
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    if (file.size > 1024 * 1024) {
      alert('Please choose an image smaller than 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditAvatarUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  // Load E2E block and mute settings
  useEffect(() => {
    if (user?.id) {
      const savedMute = localStorage.getItem(`mutedUsers_${user.id}`);
      const savedBlock = localStorage.getItem(`blockedUsers_${user.id}`);
      if (savedMute) setMutedUsers(JSON.parse(savedMute));
      if (savedBlock) setBlockedUsers(JSON.parse(savedBlock));
    }
  }, [user?.id]);

  const isMuted = selectedUser ? mutedUsers.includes(selectedUser.id) : false;
  const isBlocked = selectedUser ? blockedUsers.includes(selectedUser.id) : false;

  const handleToggleMute = () => {
    if (!selectedUser) return;
    const updated = mutedUsers.includes(selectedUser.id)
      ? mutedUsers.filter(id => id !== selectedUser.id)
      : [...mutedUsers, selectedUser.id];
    setMutedUsers(updated);
    if (user?.id) {
      localStorage.setItem(`mutedUsers_${user.id}`, JSON.stringify(updated));
    }
    setShowHeaderMenu(false);
  };

  const handleToggleBlock = () => {
    if (!selectedUser) return;
    const updated = blockedUsers.includes(selectedUser.id)
      ? blockedUsers.filter(id => id !== selectedUser.id)
      : [...blockedUsers, selectedUser.id];
    setBlockedUsers(updated);
    if (user?.id) {
      localStorage.setItem(`blockedUsers_${user.id}`, JSON.stringify(updated));
    }
    setShowHeaderMenu(false);
  };

  const handleReportUser = () => {
    if (!selectedUser) return;
    const confirmReport = window.confirm(`Are you sure you want to report ${selectedUser.username} for security audit?`);
    if (confirmReport) {
      alert(`Thank you. User ${selectedUser.username} has been reported for E2E cryptographic compliance verification.`);
    }
    setShowHeaderMenu(false);
  };

  const incrementUnreadCount = (senderId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [senderId]: (prev[senderId] || 0) + 1
    }));
  };

  const clearUnreadCount = (contactId: string) => {
    setUnreadCounts(prev => {
      if (!prev[contactId]) return prev;

      const next = { ...prev };
      delete next[contactId];
      return next;
    });
  };

  const messagesListRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const offlineSinceRef = useRef<number | null>((user?.status || 'online') === 'offline' ? Date.now() : null);

  // Sync theme with system/localstorage
  useEffect(() => {
    document.body.classList.toggle('light-theme', !isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if ((user?.status || 'online') === 'offline') {
      offlineSinceRef.current = offlineSinceRef.current ?? Date.now();
    } else {
      offlineSinceRef.current = null;
    }
  }, [user?.status]);

  // Keep track of window width for responsive adjustments
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown menus and emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cursor-aware emoji insertion helper
  const handleEmojiClick = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setInputText(prev => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? inputText.length;
    const end = input.selectionEnd ?? inputText.length;
    const newText = inputText.substring(0, start) + emoji + inputText.substring(end);
    setInputText(newText);
    
    // Keep focus and position cursor right after the emoji
    setTimeout(() => {
      input.focus();
      const newCursorPos = start + emoji.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Fetch users & initialize Socket
  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/auth/users`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      const savedProfiles = localStorage.getItem('global_user_profiles');
      const profilesMap = savedProfiles ? JSON.parse(savedProfiles) : {};
      const enrichedUsers = res.data.map((u: User) => {
        const cached = profilesMap[u.id] || {};
        return { ...u, ...cached };
      }).filter((u: User) => u.id !== user?.id);
      setUsers(enrichedUsers);
    }).catch(console.error);

    const newSocket = io(BACKEND_URL, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('receive_message', async (data: Message) => {
      const isCurrentConversation = selectedUser && (data.senderId === selectedUser.id || data.receiverId === selectedUser.id);
      const isUserOffline = (user?.status || 'online') === 'offline';

      if (data.senderId !== user?.id && (!isCurrentConversation || isUserOffline)) {
        incrementUnreadCount(data.senderId);
      }

      if ((user?.status || 'online') === 'offline') {
        return;
      }

      if (isCurrentConversation) {
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
      const visibleHistory = history.filter((msg) => {
        if ((user?.status || 'online') !== 'offline' || msg.senderId === user?.id) {
          return true;
        }

        const offlineSince = offlineSinceRef.current;
        return !offlineSince || new Date(msg.createdAt).getTime() <= offlineSince;
      });

      const decryptedHistory = await Promise.all(visibleHistory.map(async (msg) => {
        const otherId = msg.senderId === user!.id ? msg.receiverId : msg.senderId;
        const decryptedText = await decryptMessage(msg.content, msg.iv, user!.id, otherId);
        return { ...msg, decryptedText };
      }));
      setMessages(decryptedHistory);
    });

    newSocket.on('user_profile_updated', (updatedProfile: any) => {
      setUsers(prevUsers => prevUsers.map(u => {
        if (u.id === updatedProfile.userId) {
          return { ...u, ...updatedProfile };
        }
        return u;
      }));

      setSelectedUser(prevSelected => {
        if (prevSelected && prevSelected.id === updatedProfile.userId) {
          return { ...prevSelected, ...updatedProfile };
        }
        return prevSelected;
      });

      const savedProfiles = localStorage.getItem('global_user_profiles');
      const profilesMap = savedProfiles ? JSON.parse(savedProfiles) : {};
      profilesMap[updatedProfile.userId] = updatedProfile;
      localStorage.setItem('global_user_profiles', JSON.stringify(profilesMap));
    });

    return () => {
      newSocket.close();
    };
  }, [token, user?.id, user?.status, selectedUser]);

  // Automatically select the last active chat from localStorage, or default to the first user
  useEffect(() => {
    if (users.length > 0 && !selectedUser) {
      const savedActiveChatId = localStorage.getItem(`activeChatUserId_${user?.id}`);
      if (savedActiveChatId) {
        const matchedUser = users.find(u => u.id === savedActiveChatId);
        if (matchedUser) {
          setSelectedUser(matchedUser);
          return;
        }
      }
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser, user?.id]);

  // Persist selected chat to localStorage
  useEffect(() => {
    if (user?.id && selectedUser) {
      localStorage.setItem(`activeChatUserId_${user.id}`, selectedUser.id);
    }
  }, [selectedUser, user?.id]);

  // Fetch history when user selected
  useEffect(() => {
    if (socket && selectedUser) {
      socket.emit('get_messages', { withUserId: selectedUser.id });
    }
  }, [selectedUser, socket, user?.status]);

  useEffect(() => {
    if (selectedUser && (user?.status || 'online') !== 'offline') {
      clearUnreadCount(selectedUser.id);
    }
  }, [selectedUser, user?.status]);

  // Scroll to bottom on new messages
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

  const getInitials = (username: string) => {
    return username ? username[0].toUpperCase() : '';
  };

  // Deterministic avatar gradient color selection based on username
  const getAvatarColorClass = (username: string) => {
    if (!username) return 'avatar-gradient-0';
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 8;
    return `avatar-gradient-${index}`;
  };

  const renderAvatar = (profile: { username?: string; avatarUrl?: string }, className = '') => (
    <div className={`avatar-circle ${className} ${profile.avatarUrl ? 'avatar-image-circle' : getAvatarColorClass(profile.username || '')}`}>
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt="" className="avatar-image" />
      ) : (
        getInitials(profile.username || '')
      )}
    </div>
  );

  // Filter users based on search query
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      {/* Sidebar Section */}
      <aside className={`sidebar ${!showSidebar ? 'hidden' : ''}`}>
        <div className="sidebar-header">
          <button
            type="button"
            onClick={() => setShowSidebar(false)}
            className="hamburger-btn"
            aria-label="Hide sidebar"
          >
            <Menu size={22} />
          </button>

          <div className="search-container">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search contacts"
            />
          </div>
        </div>

        <div className="user-list">
          {filteredUsers.map(u => (
            <div
              key={u.id}
              onClick={() => {
                setSelectedUser(u);
                if ((user?.status || 'online') !== 'offline') {
                  clearUnreadCount(u.id);
                }
                if (windowWidth <= 768) {
                  setShowSidebar(false);
                }
              }}
              className={`user-card ${selectedUser?.id === u.id ? 'active' : ''}`}
            >
              {renderAvatar(u)}
              <div className="user-info-wrapper">
                <div className="user-name">{u.username}</div>
                <div className="user-status-text-container" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <span className={`status-dot ${u.status || 'online'}`} style={{ width: '6px', height: '6px' }} />
                  <span className={`user-status-text ${u.status || 'online'}`} style={{ fontSize: '0.78rem', marginTop: 0 }}>
                    {u.status || 'online'}
                  </span>
                </div>
              </div>
              {unreadCounts[u.id] ? (
                <span className="unread-badge" aria-label={`${unreadCounts[u.id]} unread messages`}>
                  {unreadCounts[u.id] > 99 ? '99+' : unreadCounts[u.id]}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="sidebar-profile">
          {renderAvatar(user || {}, 'sidebar-profile-avatar')}
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{user?.username}</div>
            <div className="sidebar-profile-label">
              <span className={`status-dot ${user?.status || 'online'}`} />
              {(user?.status || 'online').toUpperCase()}
            </div>
          </div>
          <div className="menu-container" ref={moreMenuRef}>
            <button 
              type="button" 
              onClick={() => setShowMoreMenu(prev => !prev)} 
              className="header-action-btn"
              aria-label="More options"
            >
              <MoreVertical size={20} />
            </button>
            <div className={`menu-dropdown ${showMoreMenu ? 'active' : ''}`} style={{ right: 0, left: 'auto', bottom: '48px', top: 'auto' }}>
              <button
                type="button"
                onClick={() => {
                  openSettings();
                  setShowMoreMenu(false);
                }}
                className="menu-item"
              >
                <Settings size={18} />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDarkMode(prev => !prev);
                  setShowMoreMenu(false);
                }}
                className="menu-item"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setShowMoreMenu(false);
                }}
                className="menu-item"
              >
                <LogOut size={18} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className="chat-area">
        {selectedUser ? (
          <>
            <header className="chat-header">
              <div 
                className="chat-header-user"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setShowContactInfoModal(true);
                }}
              >
                {(windowWidth <= 768 || !showSidebar) && (
                  <button 
                    className="header-action-btn" 
                    style={{ marginRight: 6 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSidebar(true);
                    }}
                  >
                    {windowWidth <= 768 ? <ArrowLeft size={20} /> : <Menu size={22} />}
                  </button>
                )}
                {renderAvatar(selectedUser, 'chat-header-avatar')}
                <div className="chat-header-title">
                  <span className="chat-header-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selectedUser.username}
                    {isMuted && <VolumeX size={14} style={{ color: 'var(--text-muted)' }} />}
                  </span>
                  <div className="chat-header-status-wrapper" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    <span className="chat-header-status" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={`status-dot ${selectedUser.status || 'online'}`} style={{ width: 6, height: 6 }} />
                      <span className={`user-status-text ${selectedUser.status || 'online'}`} style={{ marginTop: 0, textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 700 }}>
                        {selectedUser.status || 'online'}
                      </span>
                      {isMuted && <span style={{ opacity: 0.7, color: 'var(--text-muted)', fontSize: '0.75rem' }}>• muted</span>}
                    </span>
                    {selectedUser.description && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.85, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedUser.description}>
                        • {selectedUser.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="chat-header-actions">
                <div className="menu-container" ref={headerMenuRef}>
                  <button 
                    type="button" 
                    onClick={() => setShowHeaderMenu(prev => !prev)} 
                    className="header-action-btn"
                    aria-label="Chat options"
                  >
                    <MoreVertical size={20} />
                  </button>
                  <div className={`menu-dropdown ${showHeaderMenu ? 'active' : ''}`} style={{ right: 0, left: 'auto', top: '42px' }}>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className="menu-item"
                    >
                      {isMuted ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      <span>{isMuted ? 'Unmute User' : 'Mute Notifications'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleBlock}
                      className={`menu-item ${isBlocked ? '' : 'danger-action'}`}
                    >
                      <Ban size={18} />
                      <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReportUser}
                      className="menu-item danger-action"
                    >
                      <AlertTriangle size={18} />
                      <span>Report User</span>
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <div className="chat-messages-container" ref={messagesListRef}>
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <div className="empty-state-shield"><Shield size={42} /></div>
                  <h3>End-to-End Encrypted Chat</h3>
                  <p>Your messages are protected. Start the secure conversation with {selectedUser.username}.</p>
                </div>
              ) : null}

              {messages.map((msg) => {
                const isSent = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`message-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
                    <div className={`message-bubble ${isSent ? 'sent' : 'received'} ${!msg.decryptedText ? 'decrypt-failed' : ''}`}>
                      <span className="message-content-text">
                        {msg.decryptedText || 'Encrypted payload unavailable'}
                      </span>
                      <span className="message-meta">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        {isSent && (
                          <span className="message-status-icon">
                            {msg.delivered && (selectedUser.status || 'online') === 'online' ? (
                              <CheckCheck size={13} />
                            ) : (
                              <Check size={13} />
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {isBlocked ? (
              <div className="chat-blocked-notice">
                <span>You have blocked this contact. Unblock to resume the secure conversation.</span>
                <button 
                  type="button" 
                  onClick={handleToggleBlock} 
                  className="unblock-action-btn"
                >
                  Unblock Contact
                </button>
              </div>
            ) : (
              <form className="chat-footer" onSubmit={handleSendMessage}>
                <div className="input-pill" style={{ position: 'relative' }}>
                  <div ref={emojiPickerRef} style={{ display: 'flex', alignItems: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(prev => !prev)} 
                      className={`input-pill-btn ${showEmojiPicker ? 'active' : ''}`}
                      aria-label="Emojis"
                    >
                      <Smile size={20} />
                    </button>
                    {showEmojiPicker && (
                      <div className="emoji-picker-panel">
                        <div className="emoji-picker-grid">
                          {EMOJIS.map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="emoji-btn"
                              onClick={() => handleEmojiClick(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="chat-text-input"
                    placeholder="Message"
                  />
                  <button type="button" className="input-pill-btn" aria-label="Attachments">
                    <Paperclip size={20} />
                  </button>
                </div>
                <button 
                  type="submit" 
                  className="send-action-circle" 
                  aria-label={inputText.trim() ? 'Send message' : 'Record voice'}
                >
                  {inputText.trim() ? <Send size={18} /> : <Mic size={18} />}
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="chat-empty-state">
            <div className="empty-state-shield"><Shield size={48} /></div>
            <h3>Select a Chat</h3>
            <p>Choose a contact from the list on the left to start a secure, end-to-end encrypted conversation.</p>
            {!showSidebar && (
              <button 
                type="button" 
                className="auth-btn" 
                style={{ marginTop: 16, width: 'auto', padding: '10px 24px' }}
                onClick={() => setShowSidebar(true)}
              >
                Show Contacts
              </button>
            )}
          </div>
        )}
      </main>

      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <form className="settings-modal" onSubmit={handleSaveSettings} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Account Settings</span>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="modal-profile-header">
                <div className="profile-image-editor">
                  {renderAvatar({ username: editUsername, avatarUrl: editAvatarUrl }, 'modal-avatar')}
                  <label className="profile-image-btn" aria-label="Add or change profile image" title="Add or change profile image">
                    <Camera size={16} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      className="profile-image-input"
                    />
                  </label>
                </div>
                <div className="modal-username">{editUsername || 'User'}</div>
                <div className={`modal-status-badge ${editStatus}`}>
                  {editStatus}
                </div>
              </div>
              
              <div className="settings-form-group">
                <label className="settings-form-label">Username</label>
                <input 
                  type="text" 
                  className="settings-form-input" 
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Your display name"
                  required
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Email Address</label>
                <input 
                  type="email" 
                  className="settings-form-input" 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Phone Number</label>
                <input 
                  type="tel" 
                  className="settings-form-input" 
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +1 (234) 567-8901"
                />
              </div>

              <div className="settings-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="settings-form-label">Bio / Description</label>
                  <span style={{ fontSize: '0.72rem', color: editDesc.length >= 80 ? '#eb5757' : 'var(--text-muted)' }}>
                    {editDesc.length}/80
                  </span>
                </div>
                <textarea 
                  className="settings-form-input settings-form-textarea" 
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value.slice(0, 80))}
                  maxLength={80}
                  placeholder="A brief description about yourself"
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">Online Status</label>
                <select 
                  className="settings-form-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="dnd">Do Not Disturb (DND)</option>
                  <option value="offline">Offline / Invisible</option>
                </select>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="auth-btn" 
                style={{ width: 'auto', padding: '8px 20px', marginTop: 0, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                onClick={() => setShowSettingsModal(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="auth-btn" 
                style={{ width: 'auto', padding: '8px 20px', marginTop: 0 }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {showContactInfoModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowContactInfoModal(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Contact Info</span>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setShowContactInfoModal(false)}
                aria-label="Close contact details"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="modal-profile-header">
                {renderAvatar(selectedUser, 'modal-avatar')}
                <div className="modal-username">{selectedUser.username}</div>
                <div className={`modal-status-badge ${selectedUser.status || 'online'}`}>
                  {selectedUser.status || 'online'}
                </div>
              </div>
              
              <div className="settings-form-group">
                <label className="settings-form-label">Bio / Description</label>
                <textarea 
                  className="settings-form-input settings-form-textarea" 
                  value={selectedUser.description || 'No description shared.'}
                  readOnly
                  disabled
                  style={{ opacity: selectedUser.description ? 0.8 : 0.5, fontStyle: selectedUser.description ? 'normal' : 'italic', minHeight: '60px' }}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="auth-btn" 
                style={{ width: 'auto', padding: '8px 24px', marginTop: 0 }}
                onClick={() => setShowContactInfoModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
