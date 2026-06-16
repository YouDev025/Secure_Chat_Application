import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Search, MoreVertical, LogOut, Moon, Sun, Menu, Smile, Paperclip, Mic, Check, CheckCheck, ArrowLeft, VolumeX, Volume2, Ban, AlertTriangle, Settings, X, Camera, Trash2, ImagePlus, ImageOff, FileText, Download, Play, Pause } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { countries } from '../utils/countries';

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

interface AttachmentPayload {
  kind: 'attachment';
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024;

const getUnreadCountsStorageKey = (userId: string) => `unreadCounts_${userId}`;
const getLocalDeletedChatsStorageKey = (userId: string) => `localDeletedChats_${userId}`;

const readUnreadCounts = (userId?: string): Record<string, number> => {
  if (!userId) return {};

  try {
    const savedCounts = localStorage.getItem(getUnreadCountsStorageKey(userId));
    return savedCounts ? JSON.parse(savedCounts) : {};
  } catch {
    return {};
  }
};

const readLocalDeletedChats = (userId?: string): Record<string, string> => {
  if (!userId) return {};

  try {
    const savedDeletedChats = localStorage.getItem(getLocalDeletedChatsStorageKey(userId));
    return savedDeletedChats ? JSON.parse(savedDeletedChats) : {};
  } catch {
    return {};
  }
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const parseAttachmentPayload = (text?: string): AttachmentPayload | null => {
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (
      parsed?.kind === 'attachment' &&
      typeof parsed.name === 'string' &&
      typeof parsed.mimeType === 'string' &&
      typeof parsed.size === 'number' &&
      typeof parsed.dataUrl === 'string'
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const parsePhoneNumber = (fullPhone: string) => {
  if (!fullPhone) return { countryCode: '+1', number: '' };
  const sortedCountries = [...countries].sort((a, b) => b.dial_code.length - a.dial_code.length);
  for (const country of sortedCountries) {
    if (fullPhone.startsWith(country.dial_code)) {
      const remainingNumber = fullPhone.slice(country.dial_code.length).trim();
      return { countryCode: country.dial_code, number: remainingNumber };
    }
  }
  return { countryCode: '+1', number: fullPhone };
};

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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(() => readUnreadCounts(user?.id));
  const [localDeletedChats, setLocalDeletedChats] = useState<Record<string, string>>(() => readLocalDeletedChats(user?.id));
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
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [alsoDeleteForReceiver, setAlsoDeleteForReceiver] = useState(false);
  const [showProfileImageMenu, setShowProfileImageMenu] = useState(false);

  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhoneCountryCode, setEditPhoneCountryCode] = useState('+1');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('online');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  const [showContactInfoModal, setShowContactInfoModal] = useState(false);

  const openSettings = () => {
    setEditUsername(user?.username || '');
    setEditEmail(user?.email || '');
    const parsed = parsePhoneNumber(user?.phoneNumber || '');
    setEditPhoneCountryCode(parsed.countryCode);
    setEditPhoneNumber(parsed.number);
    setEditDesc(user?.description || '');
    setEditStatus(user?.status || 'online');
    setEditAvatarUrl(user?.avatarUrl || '');
    setShowProfileImageMenu(false);
    setShowSettingsModal(true);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const combinedPhone = editPhoneNumber.trim()
      ? `${editPhoneCountryCode}${editPhoneNumber.trim()}`
      : '';
    const updatedFields = {
      username: editUsername,
      email: editEmail,
      phoneNumber: combinedPhone,
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
    e.target.value = '';
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
      setShowProfileImageMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteProfileImage = () => {
    setEditAvatarUrl('');
    setShowProfileImageMenu(false);
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

  const handleDeleteConversationForMe = () => {
    if (!selectedUser || !user?.id) return;

    const contactId = selectedUser.id;
    setLocalDeletedChats(prev => ({
      ...prev,
      [contactId]: new Date().toISOString()
    }));
    setMessages([]);
    clearUnreadCount(contactId);
    if (user?.id) {
      localStorage.removeItem(`activeChatUserId_${user.id}`);
    }
    setSelectedUser(null);
    setShowDeleteChatModal(false);
  };

  const handleDeleteConversationForEveryone = () => {
    if (!selectedUser || !socket) return;

    const contactId = selectedUser.id;

    socket.emit('delete_conversation', { withUserId: contactId }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) {
        alert(response.error || 'Failed to delete conversation.');
        return;
      }

      setMessages([]);
      clearUnreadCount(contactId);
      setLocalDeletedChats(prev => ({
        ...prev,
        [contactId]: new Date().toISOString()
      }));
      if (user?.id) {
        localStorage.removeItem(`activeChatUserId_${user.id}`);
      }
      setSelectedUser(null);
    });
    setShowDeleteChatModal(false);
  };

  const handleConfirmDeleteConversation = () => {
    if (alsoDeleteForReceiver) {
      handleDeleteConversationForEveryone();
      return;
    }

    handleDeleteConversationForMe();
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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartRef = useRef<number | null>(null);
  const recordingTimerIntervalRef = useRef<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const isCanceledRef = useRef(false);
  const shouldSendRef = useRef(true);
  const MAX_RECORDING_SECONDS = 60;
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profileImageMenuRef = useRef<HTMLDivElement>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const offlineSinceRef = useRef<number | null>((user?.status || 'online') === 'offline' ? Date.now() : null);

  const selectedUserRef = useRef(selectedUser);
  const userRef = useRef(user);
  const localDeletedChatsRef = useRef(localDeletedChats);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    localDeletedChatsRef.current = localDeletedChats;
  }, [localDeletedChats]);

  useEffect(() => {
    if (socket && user?.status) {
      socket.auth = {
        ...socket.auth,
        status: user.status
      };
    }
  }, [socket, user?.status]);

  useEffect(() => {
    setUnreadCounts(readUnreadCounts(user?.id));
    setLocalDeletedChats(readLocalDeletedChats(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(getUnreadCountsStorageKey(user.id), JSON.stringify(unreadCounts));
  }, [unreadCounts, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(getLocalDeletedChatsStorageKey(user.id), JSON.stringify(localDeletedChats));
  }, [localDeletedChats, user?.id]);

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
      if (profileImageMenuRef.current && !profileImageMenuRef.current.contains(event.target as Node)) {
        setShowProfileImageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup media tracks when unmounting
  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      try {
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      } catch {}
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    };
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
        return { ...cached, ...u };
      }).filter((u: User) => u.id !== userRef.current?.id);
      setUsers(enrichedUsers);
    }).catch(console.error);

    const newSocket = io(BACKEND_URL, {
      auth: { 
        token,
        status: userRef.current?.status || 'online'
      }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      const currentUser = userRef.current;
      newSocket.emit('update_profile', {
        username: currentUser?.username,
        email: currentUser?.email,
        phoneNumber: currentUser?.phoneNumber,
        description: currentUser?.description,
        status: currentUser?.status || 'online',
        avatarUrl: currentUser?.avatarUrl
      });
    });

    newSocket.on('receive_message', async (data: Message) => {
      const currentSelectedUser = selectedUserRef.current;
      const currentUser = userRef.current;
      const isCurrentConversation = currentSelectedUser && (data.senderId === currentSelectedUser.id || data.receiverId === currentSelectedUser.id);
      const isUserOffline = (currentUser?.status || 'online') === 'offline';

      if (data.senderId !== currentUser?.id && (!isCurrentConversation || isUserOffline)) {
        incrementUnreadCount(data.senderId);
      }

      if ((currentUser?.status || 'online') === 'offline') {
        return;
      }

      if (isCurrentConversation && currentSelectedUser) {
        const decryptedText = await decryptMessage(data.content, data.iv, currentUser!.id, currentSelectedUser.id);
        setMessages(prev => [...prev, { ...data, decryptedText }]);
      }
    });

    newSocket.on('message_sent_confirm', async (data: Message) => {
      const currentSelectedUser = selectedUserRef.current;
      const currentUser = userRef.current;
      if (currentSelectedUser && currentUser && data.receiverId === currentSelectedUser.id) {
        const decryptedText = await decryptMessage(data.content, data.iv, currentUser.id, currentSelectedUser.id);
        setMessages(prev => [...prev, { ...data, decryptedText }]);
      }
    });

    newSocket.on('messages_delivered', (data: { receiverId: string; messageIds: string[] }) => {
      const currentSelectedUser = selectedUserRef.current;
      if (currentSelectedUser && data.receiverId === currentSelectedUser.id) {
        setMessages(prev => prev.map(msg => {
          if (data.messageIds.includes(msg.id)) {
            return { ...msg, delivered: true };
          }
          return msg;
        }));
      }
    });

    newSocket.on('chat_history', async (history: Message[]) => {
      const currentSelectedUser = selectedUserRef.current;
      const currentUser = userRef.current;
      if (!currentSelectedUser || !currentUser) return;

      const currentLocalDeletedChats = localDeletedChatsRef.current;
      const localDeletedAt = currentLocalDeletedChats[currentSelectedUser.id];
      const localDeletedTime = localDeletedAt ? new Date(localDeletedAt).getTime() : null;
      const visibleHistory = history.filter((msg) => {
        if (localDeletedTime && new Date(msg.createdAt).getTime() <= localDeletedTime) {
          return false;
        }

        if ((currentUser.status || 'online') !== 'offline' || msg.senderId === currentUser.id) {
          return true;
        }

        const offlineSince = offlineSinceRef.current;
        return !offlineSince || new Date(msg.createdAt).getTime() <= offlineSince;
      });

      const decryptedHistory = await Promise.all(visibleHistory.map(async (msg) => {
        const otherId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
        const decryptedText = await decryptMessage(msg.content, msg.iv, currentUser.id, otherId);
        return { ...msg, decryptedText };
      }));
      setMessages(decryptedHistory);
    });

    newSocket.on('conversation_deleted', (data: { withUserId: string }) => {
      const currentSelectedUser = selectedUserRef.current;
      const currentUser = userRef.current;
      clearUnreadCount(data.withUserId);
      setLocalDeletedChats(prev => ({
        ...prev,
        [data.withUserId]: new Date().toISOString()
      }));

      if (currentSelectedUser?.id === data.withUserId) {
        setMessages([]);
        setSelectedUser(null);
        if (currentUser?.id) {
          localStorage.removeItem(`activeChatUserId_${currentUser.id}`);
        }
      }
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
  }, [token, user?.id]);

  // Restore the last active chat when it is still available.
  useEffect(() => {
    if (users.length > 0 && !selectedUser) {
      const savedActiveChatId = localStorage.getItem(`activeChatUserId_${user?.id}`);
      if (savedActiveChatId) {
        const matchedUser = users.find(u => u.id === savedActiveChatId);
        if (matchedUser) {
          setSelectedUser(matchedUser);
        }
      }
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
    await sendTextMessage();
  };

  const sendTextMessage = async () => {
    if (!inputText.trim() || !selectedUser || !socket || !user) return;

    const { encrypted, iv } = await encryptMessage(inputText, user.id, selectedUser.id);
    socket.emit('send_message', {
      receiverId: selectedUser.id,
      encryptedContent: encrypted,
      iv: iv
    });
    setInputText('');
  };

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedUser || !socket || !user) return;

    if (file.size > MAX_ATTACHMENT_SIZE) {
      alert(`Please choose a file smaller than ${formatFileSize(MAX_ATTACHMENT_SIZE)}.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const payload: AttachmentPayload = {
        kind: 'attachment',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl
      };
      const { encrypted, iv } = await encryptMessage(JSON.stringify(payload), user.id, selectedUser.id);

      socket.emit('send_message', {
        receiverId: selectedUser.id,
        encryptedContent: encrypted,
        iv
      });
    } catch (error) {
      console.error('Failed to send attachment', error);
      alert('Failed to send this file.');
    }
  };

  const sendAudioBlob = async (blob: Blob) => {
    if (!selectedUser || !socket || !user) return;

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const payload: AttachmentPayload = {
        kind: 'attachment',
        name: `voice-${Date.now()}.webm`,
        mimeType: blob.type || 'audio/webm',
        size: blob.size,
        dataUrl
      };

      const { encrypted, iv } = await encryptMessage(JSON.stringify(payload), user.id, selectedUser.id);
      socket.emit('send_message', {
        receiverId: selectedUser.id,
        encryptedContent: encrypted,
        iv
      });
    } catch (err) {
      console.error('Failed to send audio', err);
      alert('Failed to send audio message.');
    }
  };

  const startRecording = async () => {
    if (isRecording || !selectedUser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const options: MediaRecorderOptions = { mimeType: 'audio/webm' } as MediaRecorderOptions;
      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      shouldSendRef.current = true;
      isCanceledRef.current = false;
      // setup audio analyser for waveform
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
        const src = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        analyserRef.current = analyser;
        drawWaveform();
      } catch (err) {
        console.warn('AudioContext not available for waveform', err);
      }

      // start timer
      recordingStartRef.current = Date.now();
      setRecordingElapsed(0);
      recordingTimerIntervalRef.current = window.setInterval(() => {
        const start = recordingStartRef.current || Date.now();
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setRecordingElapsed(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) {
          // auto-stop and keep shouldSend true
          stopRecording();
        }
      }, 250);

      mr.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        const chunks = recordedChunksRef.current;
        // cleanup analyser/context
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (analyserRef.current) analyserRef.current.disconnect();
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch {}
        }
        analyserRef.current = null;
        audioContextRef.current = null;
        animationFrameRef.current = null;

        if (recordingTimerIntervalRef.current) {
          clearInterval(recordingTimerIntervalRef.current);
          recordingTimerIntervalRef.current = null;
        }

        if (!shouldSendRef.current) {
          // discard
          recordedChunksRef.current = [];
        } else if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
          await sendAudioBlob(blob);
        }

        // stop tracks
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        setRecordingElapsed(0);
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Could not start recording', err);
      alert('Microphone access is required to record audio.');
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      mediaRecorderRef.current?.stop();
    } catch (err) {
      console.error('Error stopping recorder', err);
    }
  };

  const cancelRecording = () => {
    if (!isRecording) return;
    shouldSendRef.current = false;
    isCanceledRef.current = true;
    stopRecording();
  };

  const drawWaveform = () => {
    const canvas = recordingCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff4d4f';
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
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

  const AudioPlayer: React.FC<{ src: string; isSent: boolean }> = ({ src, isSent }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
      const a = new Audio(src);
      a.preload = 'metadata';
      audioRef.current = a;

      const onLoaded = () => setDuration(a.duration || 0);
      const onEnded = () => setPlaying(false);
      a.addEventListener('loadedmetadata', onLoaded);
      a.addEventListener('ended', onEnded);

      return () => {
        a.pause();
        a.removeEventListener('loadedmetadata', onLoaded);
        a.removeEventListener('ended', onEnded);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        audioRef.current = null;
      };
    }, [src]);

    const update = () => {
      const a = audioRef.current;
      if (!a) return;
      setCurrent(a.currentTime || 0);
      rafRef.current = requestAnimationFrame(update);
    };

    const toggle = async () => {
      const a = audioRef.current;
      if (!a) return;
      if (playing) {
        a.pause();
        setPlaying(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else {
        try {
          await a.play();
          setPlaying(true);
          rafRef.current = requestAnimationFrame(update);
        } catch (err) {
          console.error('Play failed', err);
        }
      }
    };

    const seek = (e: React.MouseEvent<HTMLDivElement>) => {
      const a = audioRef.current;
      if (!a) return;
      const rect = (e.target as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      a.currentTime = pct * (duration || 0);
      setCurrent(a.currentTime);
    };

    return (
      <div className={`custom-audio-player ${isSent ? 'sent' : 'received'}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 24, background: isSent ? '#bfdca2' : '#f2f7fb', color: 'var(--text)', minWidth: 200, maxWidth: 320 }}>
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} style={{ border: 'none', background: 'transparent', padding: 6, display: 'flex', alignItems: 'center' }}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <div onClick={seek} style={{ flex: 1, height: 6, background: 'transparent', borderRadius: 6, position: 'relative', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: `${(current / (duration || 1)) * 100}%`, height: 6, background: isSent ? '#2b8ed7' : '#1866e0', borderRadius: 6 }} />
        </div>

        <div style={{ fontSize: '0.85rem', minWidth: 40, textAlign: 'right' }}>{new Date((duration ? Math.floor(current) : 0) * 1000).toISOString().substr(14, 5)}</div>
      </div>
    );
  };

  const renderAttachment = (attachment: AttachmentPayload, isSent = false) => {
    const isImage = attachment.mimeType.startsWith('image/');
    const isVideo = attachment.mimeType.startsWith('video/');
    const isAudio = attachment.mimeType.startsWith('audio/');

    if (isAudio) {
      return <AudioPlayer src={attachment.dataUrl} isSent={isSent} />;
    }

    if (isImage) {
      return (
        <div className="message-attachment image-only-attachment">
          <img src={attachment.dataUrl} alt={attachment.name} className="attachment-image" />
        </div>
      );
    }

    return (
      <div className="message-attachment">
        {isVideo && (
          <video src={attachment.dataUrl} controls className="attachment-video" />
        )}

        {!isAudio && !isImage && (
          <a href={attachment.dataUrl} download={attachment.name} className="attachment-file-link">
            <span className="attachment-file-icon">
              {isVideo ? <Download size={18} /> : <FileText size={18} />}
            </span>
            <span className="attachment-file-details">
              <span className="attachment-file-name">{attachment.name}</span>
              <span className="attachment-file-meta">{formatFileSize(attachment.size)} · {attachment.mimeType}</span>
            </span>
          </a>
        )}
      </div>
    );
  };

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
                    <button
                      type="button"
                      onClick={() => {
                        setAlsoDeleteForReceiver(false);
                        setShowDeleteChatModal(true);
                        setShowHeaderMenu(false);
                      }}
                      className="menu-item danger-action"
                    >
                      <Trash2 size={18} />
                      <span>Delete Chat</span>
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
                const attachment = parseAttachmentPayload(msg.decryptedText);
                const isAudioMessage = attachment?.mimeType.startsWith('audio/') || false;
                return (
                  <div key={msg.id} className={`message-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
                    <div className={`message-bubble ${isSent ? 'sent' : 'received'} ${isAudioMessage ? 'audio-attachment' : ''} ${!msg.decryptedText ? 'decrypt-failed' : ''}`}>
                      {attachment ? (
                        renderAttachment(attachment, isSent)
                      ) : (
                        <span className="message-content-text">
                          {msg.decryptedText || 'Encrypted payload unavailable'}
                        </span>
                      )}
                      {!isAudioMessage && (
                        <span className="message-meta">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          {isSent && (
                            <span className="message-status-icon">
                              {msg.delivered ? (
                                <CheckCheck size={13} />
                              ) : (
                                <Check size={13} />
                              )}
                            </span>
                          )}
                        </span>
                      )}
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
              <form className="chat-footer" onSubmit={(e) => { e.preventDefault(); sendTextMessage(); }}>
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
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    onChange={handleAttachmentChange}
                    className="attachment-input"
                  />
                  <button
                    type="button"
                    className="input-pill-btn"
                    aria-label="Send attachment"
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    <Paperclip size={20} />
                  </button>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isRecording && (
                    <div className="recording-indicator" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 10, background: '#ff4d4f' }} />
                      <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{new Date(recordingElapsed * 1000).toISOString().substr(14, 5)}</div>
                      <canvas ref={recordingCanvasRef as any} width={120} height={24} style={{ borderRadius: 4, background: 'transparent' }} />
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', opacity: 0.9 }}>{isCanceledRef.current ? 'Canceled' : 'Slide left to cancel'}</div>
                    </div>
                  )}

                  <button
                    type="button"
                    className={`send-action-circle ${isRecording ? 'recording' : ''}`}
                    aria-label={inputText.trim() ? 'Send message' : 'Record voice'}
                    onMouseDown={(e) => {
                      if (!inputText.trim()) {
                        e.preventDefault();
                        startXRef.current = e.clientX;
                        startRecording();
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isRecording && startXRef.current != null) {
                        const delta = e.clientX - startXRef.current;
                        if (delta < -50) cancelRecording();
                      }
                    }}
                    onMouseUp={(e) => { if (!inputText.trim()) { e.preventDefault(); stopRecording(); startXRef.current = null; } }}
                    onMouseLeave={(e) => { if (!inputText.trim() && isRecording) { e.preventDefault(); stopRecording(); startXRef.current = null; } }}
                    onTouchStart={(e) => { e.preventDefault(); if (!inputText.trim()) { startXRef.current = e.touches[0].clientX; startRecording(); } }}
                    onTouchMove={(e) => {
                      if (isRecording && startXRef.current != null) {
                        const x = e.touches[0].clientX;
                        const delta = x - startXRef.current;
                        if (delta < -50) cancelRecording();
                      }
                    }}
                    onTouchEnd={(e) => { e.preventDefault(); if (!inputText.trim()) { stopRecording(); startXRef.current = null; } }}
                    onClick={async (e) => {
                      e.preventDefault();
                      if (inputText.trim()) {
                        await sendTextMessage();
                      } else {
                        // tap without hold: focus input
                        inputRef.current?.focus();
                      }
                    }}
                  >
                    {inputText.trim() ? <Send size={18} /> : <Mic size={18} />}
                  </button>
                </div>
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
                <div className="profile-image-editor" ref={profileImageMenuRef}>
                  {renderAvatar({ username: editUsername, avatarUrl: editAvatarUrl }, 'modal-avatar')}
                  <button
                    type="button"
                    className="profile-image-btn"
                    aria-label="Profile image options"
                    title="Profile image options"
                    onClick={() => setShowProfileImageMenu(prev => !prev)}
                  >
                    <Camera size={16} />
                  </button>
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    className="profile-image-input"
                  />
                  {showProfileImageMenu && (
                    <div className="profile-image-menu">
                      <button
                        type="button"
                        className="profile-image-menu-item"
                        onClick={() => profileImageInputRef.current?.click()}
                      >
                        <ImagePlus size={16} />
                        <span>Change image</span>
                      </button>
                      <button
                        type="button"
                        className="profile-image-menu-item danger-action"
                        onClick={handleDeleteProfileImage}
                        disabled={!editAvatarUrl}
                      >
                        <ImageOff size={16} />
                        <span>Delete current image</span>
                      </button>
                    </div>
                  )}
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
                <div className="phone-input-container">
                  <select
                    className="settings-form-select phone-country-select"
                    value={editPhoneCountryCode}
                    onChange={(e) => setEditPhoneCountryCode(e.target.value)}
                  >
                    {countries.map((c, i) => (
                      <option key={i} value={c.dial_code}>
                        {c.flag} {c.dial_code} ({c.name})
                      </option>
                    ))}
                  </select>
                  <input 
                    type="tel" 
                    className="settings-form-input phone-number-input" 
                    value={editPhoneNumber}
                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                    placeholder="e.g. (234) 567-8901"
                  />
                </div>
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
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
            
            <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
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

      {showDeleteChatModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDeleteChatModal(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {renderAvatar(selectedUser, 'sidebar-profile-avatar')}
                <span className="modal-title">Delete chat</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDeleteChatModal(false)}
                aria-label="Close delete chat options"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.55 }}>
                Are you sure you want to delete all message history with {selectedUser.username}?
              </p>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.55 }}>
                This action cannot be undone.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={alsoDeleteForReceiver}
                  onChange={(e) => setAlsoDeleteForReceiver(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span>Also delete for {selectedUser.username}</span>
              </label>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', marginTop: 0, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                onClick={() => setShowDeleteChatModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', marginTop: 0, background: 'var(--error-text)' }}
                onClick={handleConfirmDeleteConversation}
              >
                Delete
              </button>
            </div>
          </div>
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
