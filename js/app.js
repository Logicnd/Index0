// =============================================
//          REMOTE LOGGING SETUP
// =============================================
(function setupRemoteLogging() {
    const originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console),
    };

    const sendLogToServer = (level, args) => {
        try {
            const message = args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');

            // Use sendBeacon for reliability, especially on page unload
            navigator.sendBeacon(`${API_BASE}/api/log`, JSON.stringify({
                level,
                message,
                context: { userAgent: navigator.userAgent, url: window.location.href }
            }));
        } catch (e) {
            // Avoid an infinite loop if logging the logging error fails
            originalConsole.error('Failed to send log to server:', e);
        }
    };

    console.log = function(...args) {
        originalConsole.log(...args);
        sendLogToServer('log', args);
    };
    console.error = function(...args) {
        originalConsole.error(...args);
        sendLogToServer('error', args);
    };
    console.warn = function(...args) {
        originalConsole.warn(...args);
        sendLogToServer('warn', args);
    };
    console.info = function(...args) {
        originalConsole.info(...args);
        sendLogToServer('info', args);
    };
    console.debug = function(...args) {
        originalConsole.debug(...args);
        sendLogToServer('debug', args);
    };

    window.addEventListener('error', event => {
        console.error('Unhandled Global Error:', event.message, 'at', event.filename, ':', event.lineno);
    });

    window.addEventListener('unhandledrejection', event => {
        console.error('Unhandled Promise Rejection:', event.reason);
    });

    originalConsole.log('Remote logging initialized.');
})();


const CHANNELS = [
  { id: 'general', name: '#general' },
  { id: 'rules', name: '#rules', isReadOnly: true },
  { id: 'random', name: '#random' },
  { id: 'tech', name: '#tech' },
  { id: 'member-activity', name: '#member-activity', isHidden: true }
];

const ADMIN_USERNAMES = ['kiri']; // Case-insensitive check will be used

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3000' 
  : 'https://index0-backend.onrender.com';

const STORAGE_KEYS = {
  token: 'index0_token',
  user: 'index0_user',
  settings: 'index0_settings'
};

const dom = {
  app: document.getElementById('app'),
  sidebar: document.getElementById('sidebar'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  channelList: document.getElementById('channelList'),
  dmList: document.getElementById('dmList'),
  userList: document.getElementById('userList'),
  chatLog: document.getElementById('chatLog'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  roomLabel: document.getElementById('roomLabel'),
  roomTypeLabel: document.getElementById('roomTypeLabel'),
  
  profilePanel: document.getElementById('profilePanel'),
  profileUsername: document.getElementById('profileUsername'),
  settingsBtn: document.getElementById('settingsBtn'), // Changed from editProfileBtn
  logoutBtn: document.getElementById('logoutBtn'),
  
  authModal: document.getElementById('authModal'),
  authTitle: document.getElementById('authTitle'),
  authForm: document.getElementById('authForm'),
  usernameInput: document.getElementById('username'),
  passwordInput: document.getElementById('password'),
  authSubmitBtn: document.getElementById('authSubmit'),
  authToggle: document.getElementById('authToggle'),
  authError: document.getElementById('authError'),

  // Settings Modal
  settingsModal: document.getElementById('settingsModal'),
  settingsCloseBtn: document.getElementById('settingsCloseBtn'),
  settingsTabs: document.querySelectorAll('.modal-tab'),
  settingsTabContents: document.querySelectorAll('.modal-tab-content'),
  
  // Profile Tab
  profileForm: document.getElementById('profileForm'),
  displayNameInput: document.getElementById('displayNameInput'),
  
  // Logout Button in Modal
  logoutModalBtn: document.getElementById('logoutModalBtn')
};

const typingIndicator = document.createElement('div');
typingIndicator.id = 'typingIndicator';
typingIndicator.className = 'typing-indicator';
if (dom.chatLog && dom.chatLog.parentElement) {
  dom.chatLog.insertAdjacentElement('afterend', typingIndicator);
}

const connectionStatus = document.createElement('span');
connectionStatus.className = 'connection-status status-pill';
if (dom.roomTypeLabel && dom.roomTypeLabel.parentElement) {
  dom.roomTypeLabel.insertAdjacentElement('afterend', connectionStatus);
}

const state = {
  currentUser: null,
  currentRoom: { type: 'channel', id: 'general' },
  onlineUsers: [],
  messages: new Map(),
  unreadCounts: new Map(),
  socket: null,
  typingTimeout: null,
  isTyping: false,
  authMode: 'login',
  subscriptions: new Set(),
  typingUsers: new Map(),
  pendingRoomLoads: new Set(),
  lastSendAt: 0,
  reconnecting: false
};

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hashString(input) {
  let hash = 0;
  const value = String(input || '');
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getHandleClass(handle) {
    const user = state.onlineUsers.find(u => u.username === handle);
    if (user && user.isAdmin) {
        return 'admin-handle';
    }
    return `handle-tone-${hashString(handle) % 12}`;
}

function getRoomKey(type, id) {
  if (type === 'channel') {
    return `channel:${id}`;
  }

  if (!state.currentUser) {
    return null;
  }

  const ids = [String(state.currentUser.id), String(id)].sort();
  return `dm:${ids[0]}:${ids[1]}`;
}

function isCurrentRoom(type, id) {
  return state.currentRoom.type === type && String(state.currentRoom.id) === String(id);
}

function escapeText(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.textContent;
}

function setConnectionStatus(text) {
  connectionStatus.textContent = text;
}

function showAuthModal() {
  if (dom.authModal) {
    dom.authModal.classList.add('active');
  }
}

function hideAuthModal() {
  if (dom.authModal) {
    dom.authModal.classList.remove('active');
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  if (dom.authTitle) {
    dom.authTitle.textContent = mode === 'signup' ? 'Sign Up' : 'Login';
  }
  if (dom.authSubmitBtn) {
    dom.authSubmitBtn.textContent = mode === 'signup' ? 'Create Account' : 'Login';
  }
  if (dom.authToggle) {
    dom.authToggle.innerHTML = mode === 'signup'
      ? 'Already have an account? <span class="toggle-link">Login</span>'
      : 'Need an account? <span class="toggle-link">Sign up</span>';
  }
  clearAuthError();
}

function showAuthError(message) {
  if (!dom.authError) {
    return;
  }

  dom.authError.textContent = message;
  dom.authError.classList.add('visible');
}

function clearAuthError() {
  if (!dom.authError) {
    return;
  }

  dom.authError.textContent = '';
  dom.authError.classList.remove('visible');
}

function setSession(token, user) {
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
}

function getStoredToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function getStoredUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) {
    return null;
  }

  try {
    const user = JSON.parse(raw);
    user.isAdmin = ADMIN_USERNAMES.includes(user.username.toLowerCase());
    return user;
  } catch {
    return null;
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    console.warn(`Request to ${url} timed out after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

  return fetch(fullUrl, {
    ...options,
    signal: controller.signal
  }).catch(error => {
      if (error.name === 'AbortError') {
          // This is our self-induced timeout
          throw new Error(`Request timed out. The server didn't respond in time.`);
      }
      // This is a different network error (e.g., CORS, DNS, server unreachable)
      throw new Error(`Network error: ${error.message}`);
  }).finally(() => window.clearTimeout(timeoutId));
}

async function apiRequest(pathname, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetchWithTimeout(pathname, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function ensureMessageArray(roomKey) {
  if (!state.messages.has(roomKey)) {
    state.messages.set(roomKey, []);
  }
  return state.messages.get(roomKey);
}

function addMessage(roomKey, message) {
  const roomMessages = ensureMessageArray(roomKey);
  roomMessages.push(message);

  if (roomMessages.length > 200) {
    roomMessages.splice(0, roomMessages.length - 200);
  }

  state.messages.set(roomKey, roomMessages);
}

function incrementUnread(roomKey) {
    if (!roomKey || isCurrentRoomFromKey(roomKey)) {
        return;
    }
    const currentCount = state.unreadCounts.get(roomKey) || 0;
    state.unreadCounts.set(roomKey, currentCount + 1);
}

function clearUnread(roomKey) {
    if (state.unreadCounts.has(roomKey)) {
        state.unreadCounts.delete(roomKey);
    }
}

function isCurrentRoomFromKey(roomKey) {
  return roomKey === getRoomKey(state.currentRoom.type, state.currentRoom.id);
}

function scrollChatToBottom() {
  if (!dom.chatLog) {
    return;
  }

  dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
}

function renderMessages() {
  if (!dom.chatLog || !state.currentUser) {
    return;
  }

  const roomKey = getRoomKey(state.currentRoom.type, state.currentRoom.id);
  const roomMessages = state.messages.get(roomKey) || [];

  dom.chatLog.innerHTML = '';
  
  const channel = CHANNELS.find(c => c.id === state.currentRoom.id);
  if (channel && channel.id === 'rules' && !roomMessages.length) {
      const rules = [
          "Be respectful to all members.",
          "No spamming or self-promotion.",
          "No NSFW content.",
          "Do not share personal information.",
          "Follow the Discord Terms of Service."
      ];
      rules.forEach(rule => {
          addMessage(roomKey, { type: 'system', text: rule, timestamp: Date.now() });
      });
  }


  if (!roomMessages.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'msg system';
    const timeNode = document.createElement('span');
    timeNode.className = 'time';
    timeNode.textContent = formatTime(Date.now());
    const bodyNode = document.createElement('span');
    bodyNode.className = 'body';
    bodyNode.textContent = 'No messages yet.';
    emptyState.append(timeNode, bodyNode);
    dom.chatLog.appendChild(emptyState);
    scrollChatToBottom();
    return;
  }

  roomMessages.forEach((message) => {
    const row = document.createElement('div');
    const isCurrentUserMsg = message.userId === state.currentUser.id;
    row.className = message.type === 'system' ? 'msg system' : 'msg';
    if (isCurrentUserMsg) {
        row.classList.add('current-user');
    }


    const timeNode = document.createElement('span');
    timeNode.className = 'time';
    timeNode.textContent = formatTime(message.timestamp);
    row.appendChild(timeNode);

    if (message.type === 'system') {
      const bodyNode = document.createElement('span');
      bodyNode.className = 'body';
      bodyNode.textContent = message.text;
      row.appendChild(bodyNode);
    } else {
      const handleNode = document.createElement('span');
      const user = state.onlineUsers.find(u => u.id === message.userId);
      const displayName = user?.nickname || user?.username || message.handle || 'User';
      handleNode.className = `handle ${getHandleClass(displayName)}`;
      handleNode.textContent = `${displayName}: `;

      const bodyNode = document.createElement('span');
      bodyNode.className = 'body';
      bodyNode.textContent = message.text;

      row.append(handleNode, bodyNode);
    }

    if (message.pending) {
      row.classList.add('pending');
    }

    dom.chatLog.appendChild(row);
  });

  scrollChatToBottom();
  clearUnread(roomKey);
  renderSidebar();
}

function updateRoomHeader() {
  if (!dom.roomLabel || !dom.roomTypeLabel) {
    return;
  }

  if (state.currentRoom.type === 'channel') {
    const channel = CHANNELS.find((entry) => entry.id === state.currentRoom.id);
    dom.roomLabel.textContent = channel ? channel.name : `#${state.currentRoom.id}`;
    dom.roomTypeLabel.textContent = 'channel';
  } else {
    const peer = state.onlineUsers.find((user) => String(user.id) === String(state.currentRoom.id));
    dom.roomLabel.textContent = peer ? `@${peer.nickname || peer.username}` : `@${state.currentRoom.id}`;
    dom.roomTypeLabel.textContent = 'direct message';
  }

  document.title = `${dom.roomLabel.textContent} · Index0`;
}

function renderTypingIndicator() {
  const roomKey = getRoomKey(state.currentRoom.type, state.currentRoom.id);
  const typingUsers = state.typingUsers.get(roomKey) || new Set();

  if (!typingUsers.size) {
    typingIndicator.textContent = '';
    return;
  }

  const names = Array.from(typingUsers.values());
  const label = names.length === 1 ? `${names[0]} is typing...` : `${names.join(', ')} are typing...`;
  typingIndicator.textContent = label;
}

function renderSidebar() {
  if (!dom.channelList || !dom.dmList) {
    return;
  }

  dom.channelList.innerHTML = '';
  CHANNELS.filter(c => !c.isHidden).forEach((channel) => {
    const roomKey = `channel:${channel.id}`;
    const item = document.createElement('div');
    item.className = 'sidebar-item';
    if (isCurrentRoom('channel', channel.id)) {
      item.classList.add('active');
    }

    const label = document.createElement('span');
    label.textContent = channel.name;
    item.appendChild(label);

    const unreadCount = state.unreadCounts.get(roomKey);
    if (unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.textContent = unreadCount > 999 ? '1k+' : unreadCount;
        item.appendChild(badge);
    }

    item.addEventListener('click', () => switchRoom('channel', channel.id));
    dom.channelList.appendChild(item);
  });

  dom.dmList.innerHTML = '';
  const directPeers = state.onlineUsers.filter((user) => !state.currentUser || String(user.id) !== String(state.currentUser.id));

  if (!directPeers.length) {
    const empty = document.createElement('div');
    empty.className = 'sidebar-item empty';
    empty.textContent = 'No DMs yet';
    dom.dmList.appendChild(empty);
  } else {
    directPeers.forEach((peer) => {
      const roomKey = getRoomKey('dm', peer.id);
      const item = document.createElement('div');
      item.className = 'sidebar-item';
      if (isCurrentRoom('dm', peer.id)) {
        item.classList.add('active');
      }

      const label = document.createElement('span');
      label.textContent = `@${peer.nickname || peer.username}`;
      item.appendChild(label);

      const unreadCount = state.unreadCounts.get(roomKey);
      if (unreadCount > 0) {
          const badge = document.createElement('span');
          badge.className = 'notification-badge';
          badge.textContent = unreadCount > 999 ? '1k+' : unreadCount;
          item.appendChild(badge);
      }

      item.addEventListener('click', () => switchRoom('dm', peer.id));
      dom.dmList.appendChild(item);
    });
  }
}

function renderUsers() {
  if (!dom.userList) {
    return;
  }

  const userbarTitle = document.querySelector('#userbar .section-title');
  if (userbarTitle) {
    userbarTitle.textContent = `USERS - ${state.onlineUsers.length}`;
  }

  dom.userList.innerHTML = '';
  if (!state.onlineUsers.length) {
    const empty = document.createElement('div');
    empty.className = 'sidebar-item empty';
    empty.textContent = 'No users online';
    dom.userList.appendChild(empty);
    return;
  }

  const sortedUsers = [...state.onlineUsers].sort((a, b) => {
      const aName = a.nickname || a.username;
      const bName = b.nickname || b.username;
      return aName.localeCompare(bName);
  });

  sortedUsers.forEach((user) => {
    const item = document.createElement('div');
    item.className = 'user-item';
    const isCurrentUser = state.currentUser && String(user.id) === String(state.currentUser.id);
    if (isCurrentUser) {
        item.classList.add('current-user');
    }

    const status = document.createElement('span');
    status.className = 'user-status';
    status.textContent = '●';

    const label = document.createElement('span');
    label.textContent = `${user.nickname || user.username}`;

    item.append(status, label);

    if (user.isAdmin) {
      const badge = document.createElement('span');
      badge.className = 'admin-badge';
      badge.textContent = '♛';
      item.appendChild(badge);
    }

    item.addEventListener('click', (e) => {
        e.stopPropagation();
        // In a real app, you'd show a context menu or profile modal
        if (!isCurrentUser) {
            switchRoom('dm', user.id);
        }
    });

    dom.userList.appendChild(item);
  });
}

function joinRoom(type, id) {
  if (!state.socket || !state.socket.connected) {
    return;
  }

  const roomKey = getRoomKey(type, id);
  if (!roomKey || state.subscriptions.has(roomKey)) {
    return;
  }

  state.subscriptions.add(roomKey);
  state.socket.emit('join_room', { type, id });
}

function leaveRoom(type, id) {
  if (!state.socket || !state.socket.connected) {
    return;
  }

  const roomKey = getRoomKey(type, id);
  if (!roomKey || !state.subscriptions.has(roomKey)) {
    return;
  }

  state.subscriptions.delete(roomKey);
  state.socket.emit('leave_room', { type, id });
}

function joinDefaultRooms() {
  CHANNELS.forEach((channel) => joinRoom('channel', channel.id));
}

function syncDmSubscriptions() {
  if (!state.currentUser) {
    return;
  }

  const desiredDmRooms = new Set(
    state.onlineUsers
      .filter((user) => String(user.id) !== String(state.currentUser.id))
      .map((user) => getRoomKey('dm', user.id))
  );

  for (const roomKey of Array.from(state.subscriptions.values())) {
    if (!roomKey.startsWith('dm:')) {
      continue;
    }

    if (!desiredDmRooms.has(roomKey)) {
      const [, first, second] = roomKey.split(':');
      const peerId = String(first) === String(state.currentUser.id) ? second : first;
      leaveRoom('dm', peerId);
    }
  }

  desiredDmRooms.forEach((roomKey) => {
    if (!state.subscriptions.has(roomKey)) {
      const peerId = roomKey.split(':').pop();
      joinRoom('dm', peerId);
    }
  });
}

function syncSubscriptions() {
  joinDefaultRooms();
  syncDmSubscriptions();
}

async function loadRoomHistory(type, id, force = false) {
  if (!state.currentUser) {
    return;
  }

  const roomKey = getRoomKey(type, id);
  if (!roomKey || (state.pendingRoomLoads.has(roomKey) && !force)) {
    return;
  }

  state.pendingRoomLoads.add(roomKey);

  try {
    const data = await apiRequest(`/api/messages/${encodeURIComponent(type)}/${encodeURIComponent(String(id))}`);
    state.messages.set(data.roomKey || roomKey, Array.isArray(data.messages) ? data.messages : []);

    if (isCurrentRoom(type, id)) {
      renderMessages();
      renderTypingIndicator();
    }
  } catch (error) {
    if (isCurrentRoom(type, id)) {
      setConnectionStatus(error.message || 'Unable to load messages');
    }
  } finally {
    state.pendingRoomLoads.delete(roomKey);
  }
}

function appendMessage(roomKey, message, options = {}) {
  addMessage(roomKey, message);

  if (options.render !== false && isCurrentRoomFromKey(roomKey)) {
    renderMessages();
  } else {
    incrementUnread(roomKey);
    renderSidebar();
  }
}

function createLocalMessage(text) {
  return {
    type: 'user',
    handle: state.currentUser.nickname || state.currentUser.username,
    text,
    timestamp: Date.now(),
    userId: state.currentUser.id,
    pending: true,
    clientId: `${Date.now()}-${Math.random().toString(16).slice(2)}`
  };
}

function removePendingMessage(roomKey, clientId) {
  const roomMessages = state.messages.get(roomKey) || [];
  const filtered = roomMessages.filter((message) => message.clientId !== clientId);
  state.messages.set(roomKey, filtered);
  if (isCurrentRoomFromKey(roomKey)) {
    renderMessages();
  }
}

function markPendingDelivered(roomKey, clientId) {
  const roomMessages = state.messages.get(roomKey) || [];
  const pendingMessage = roomMessages.find((message) => message.clientId === clientId);
  if (pendingMessage) {
    pendingMessage.pending = false;
  }
  if (isCurrentRoomFromKey(roomKey)) {
    renderMessages();
  }
}

function sendTypingState(isTyping) {
  if (!state.socket || !state.socket.connected) {
    return;
  }

  const room = state.currentRoom;
  state.socket.emit('typing', {
    type: room.type,
    id: room.id,
    isTyping
  });
}

function handleInputTyping() {
  if (!state.currentUser) {
    return;
  }

  if (!state.isTyping) {
    state.isTyping = true;
    sendTypingState(true);
  }

  if (state.typingTimeout) {
    window.clearTimeout(state.typingTimeout);
  }

  state.typingTimeout = window.setTimeout(() => {
    state.isTyping = false;
    sendTypingState(false);
  }, 3000);
}

function handleSocketMessage(message) {
  const roomKey = message.roomKey || getRoomKey(state.currentRoom.type, state.currentRoom.id);
  if (!roomKey) {
    return;
  }

  const payload = {
    ...message,
    pending: false
  };

  appendMessage(roomKey, payload, { render: true });
}

function handleSocketSystemMessage(message) {
    const activityChannelKey = 'channel:member-activity';
    appendMessage(activityChannelKey, {
        type: 'system',
        text: message.text,
        timestamp: message.timestamp,
    });
}

function handleSocketTyping(payload) {
  if (!payload.roomKey || !state.currentUser) {
    return;
  }

  const usernames = new Set(state.typingUsers.get(payload.roomKey) || []);
  if (String(payload.userId) === String(state.currentUser.id)) {
    return;
  }

  if (payload.isTyping) {
    usernames.add(payload.username);
  } else {
    usernames.delete(payload.username);
  }

  if (usernames.size) {
    state.typingUsers.set(payload.roomKey, usernames);
  } else {
    state.typingUsers.delete(payload.roomKey);
  }

  renderTypingIndicator();
}

function handleUserListUpdate(users) {
  state.onlineUsers = (Array.isArray(users) ? users : []).map(u => ({
      ...u,
      isAdmin: ADMIN_USERNAMES.includes(u.username.toLowerCase())
  }));
  renderUsers();
  renderSidebar();
  syncDmSubscriptions();
}

function handleJoinLeaveNotice(data) {
    handleUserListUpdate(data.onlineUsers);
}

function updateProfileUI() {
  if (!state.currentUser) {
    return;
  }
  
  if (dom.profilePanel) {
    dom.profilePanel.hidden = false;
  }
  if (dom.profileUsername) {
    dom.profileUsername.textContent = state.currentUser.nickname || state.currentUser.username;
  }
  if (dom.displayNameInput) {
      dom.displayNameInput.value = state.currentUser.nickname || '';
  }
}

function resetProfileUI() {
  if (dom.profilePanel) {
    dom.profilePanel.hidden = true;
  }
}

function setAppConnected(connected) {
  if (connected) {
    setConnectionStatus('Online');
  } else {
    setConnectionStatus('Disconnected');
  }
}

function connectSocket(token) {
  if (state.socket) {
    state.socket.disconnect();
  }

  state.socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 5000
  });

  state.socket.on('connect', () => {
    state.reconnecting = false;
    setAppConnected(true);
    hideAuthModal();
    joinDefaultRooms();
    syncDmSubscriptions();
    ensureCurrentRoomSubscription();
    loadRoomHistory(state.currentRoom.type, state.currentRoom.id, true);
  });

  state.socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') {
      state.reconnecting = true;
      setConnectionStatus('Reconnecting');
    } else {
      setAppConnected(false);
    }
  });

  state.socket.on('connect_error', (error) => {
    const message = error && error.message ? error.message : 'Connection failed';
    if (/invalid token|authentication required/i.test(message)) {
      logout();
      showAuthError('Session expired. Please log in again.');
      return;
    }

    setConnectionStatus('Connecting...');
  });

  state.socket.on('new_message', handleSocketMessage);
  state.socket.on('system_message', handleSocketSystemMessage);
  state.socket.on('typing', handleSocketTyping);
  state.socket.on('user_list_update', handleUserListUpdate);
  state.socket.on('user_joined', handleJoinLeaveNotice);
  state.socket.on('user_left', handleJoinLeaveNotice);

  state.socket.on('user_updated', (updatedUser) => {
    const userIndex = state.onlineUsers.findIndex(u => u.id === updatedUser.id);
    if (userIndex > -1) {
      state.onlineUsers[userIndex] = { ...state.onlineUsers[userIndex], ...updatedUser };
    }
    if (state.currentUser.id === updatedUser.id) {
        state.currentUser = { ...state.currentUser, ...updatedUser };
        updateProfileUI();
    }
    renderUsers();
    renderSidebar();
    if (isCurrentRoom('dm', updatedUser.id)) {
        updateRoomHeader();
    }
  });
}

function openSettingsModal() {
    dom.settingsModal.style.display = 'block';
    // Set initial tab
    if (dom.settingsTabs.length > 0) {
        dom.settingsTabs[0].click();
    }
}

function closeSettingsModal() {
    dom.settingsModal.style.display = 'none';
}

function setupEventListeners() {
    if (dom.toggleSidebarBtn) {
        dom.toggleSidebarBtn.addEventListener('click', () => {
            dom.sidebar.classList.toggle('collapsed');
            dom.app.classList.toggle('sidebar-collapsed');
        });
    }

    if (dom.sendBtn && dom.messageInput) {
        dom.sendBtn.addEventListener('click', sendMessage);
        dom.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        dom.messageInput.addEventListener('input', handleInputTyping);
    }

    if (dom.authForm) {
        dom.authForm.addEventListener('submit', handleAuthSubmit);
    }

    if (dom.authToggle) {
        dom.authToggle.addEventListener('click', () => {
            setAuthMode(state.authMode === 'login' ? 'signup' : 'login');
        });
    }

    if (dom.settingsBtn) {
        dom.settingsBtn.addEventListener('click', openSettingsModal);
    }
    
    if (dom.logoutBtn) {
        dom.logoutBtn.addEventListener('click', logout);
    }

    if (dom.settingsCloseBtn) {
        dom.settingsCloseBtn.addEventListener('click', closeSettingsModal);
    }

    if (dom.settingsTabs) {
        dom.settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                
                dom.settingsTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                dom.settingsTabContents.forEach(c => c.classList.remove('active'));
                document.getElementById(target).classList.add('active');
            });
        });
    }

    if (dom.profileForm) {
        dom.profileForm.addEventListener('submit', handleProfileUpdate);
    }

    if (dom.logoutModalBtn) {
        dom.logoutModalBtn.addEventListener('click', logout);
    }

    window.addEventListener('click', (e) => {
        if (e.target === dom.settingsModal) {
            closeSettingsModal();
        }
    });
}

async function bootstrap() {
  setupEventListeners();
  setAuthMode('login');
  updateRoomHeader();
  setAppConnected(false);
  if (dom.logoutBtn) {
    dom.logoutBtn.hidden = true;
  }

  const session = await validateStoredSession();
  if (!session) {
    showAuthModal();
    return;
  }

  setSession(session.token, session.user);
  await startChat(session.user, session.token);
}

bootstrap();