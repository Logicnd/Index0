const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: (origin, callback) => callback(null, true), // Allow all origins for Vercel
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'index0-secure-key-2024';
const SALT_ROUNDS = 10;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_LENGTH = 200;
const MESSAGE_RATE_LIMIT = 5;
const MESSAGE_RATE_WINDOW_MS = 2000;
const AUTH_RATE_LIMIT = 8;
const AUTH_RATE_WINDOW_MS = 60 * 1000;
const CHANNELS = ['general', 'random', 'tech'];

const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

let usersCache = { users: [] };
let messageHistory = new Map();
let onlineUsers = new Map();
let authAttempts = new Map();
let messageBuckets = new Map();
let messageSaveTimer = null;

app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow all origins for Vercel
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..')));

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function ensureFile(filePath, defaultValue) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, defaultValue, 'utf8');
  }
}

async function loadUsers() {
  const raw = await fs.readFile(USERS_FILE, 'utf8');
  const parsed = safeJsonParse(raw, { users: [] });
  if (!parsed || !Array.isArray(parsed.users)) {
    return { users: [] };
  }
  return {
    users: parsed.users.map((user) => ({
      id: String(user.id),
      username: String(user.username || '').trim(),
      password: String(user.password || ''),
      createdAt: user.createdAt || new Date().toISOString(),
      isAdmin: Boolean(user.isAdmin)
    }))
  };
}

async function saveUsers() {
  await fs.writeFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf8');
}

async function loadMessages() {
  const raw = await fs.readFile(MESSAGES_FILE, 'utf8');
  const parsed = safeJsonParse(raw, {});
  const nextHistory = new Map();

  if (parsed && typeof parsed === 'object') {
    Object.entries(parsed).forEach(([roomKey, value]) => {
      if (Array.isArray(value)) {
        nextHistory.set(roomKey, value.slice(-MAX_HISTORY_LENGTH));
      }
    });
  }

  return nextHistory;
}

async function saveMessages() {
  const snapshot = {};
  for (const [roomKey, messages] of messageHistory.entries()) {
    snapshot[roomKey] = messages.slice(-MAX_HISTORY_LENGTH);
  }
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
}

function queueMessageSave() {
  if (messageSaveTimer) {
    return;
  }

  messageSaveTimer = setTimeout(async () => {
    messageSaveTimer = null;
    try {
      await saveMessages();
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }, 50);
}

function findUserByUsername(username) {
  const normalized = String(username || '').trim().toLowerCase();
  return usersCache.users.find((user) => user.username.toLowerCase() === normalized);
}

function findUserById(userId) {
  return usersCache.users.find((user) => String(user.id) === String(userId));
}

function validateUsername(username) {
  return /^[A-Za-z0-9_]{3,20}$/.test(String(username || '').trim());
}

function sanitizeRoomId(roomType, roomId) {
  const normalized = String(roomId || '').trim();
  if (!normalized || normalized.length > 64) {
    return null;
  }

  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return null;
  }

  if (roomType === 'channel') {
    return normalized;
  }

  if (roomType === 'dm') {
    return normalized;
  }

  return null;
}

function getRoomKey(roomType, roomId, userId) {
  const safeRoomId = sanitizeRoomId(roomType, roomId);
  if (!safeRoomId) {
    return null;
  }

  if (roomType === 'channel') {
    return `channel:${safeRoomId}`;
  }

  if (!userId) {
    return null;
  }

  const pair = [String(userId), String(safeRoomId)].sort();
  return `dm:${pair[0]}:${pair[1]}`;
}

function makePublicUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    isAdmin: Boolean(user.isAdmin),
    createdAt: user.createdAt
  };
}

function createToken(user) {
  return jwt.sign(
    {
      userId: String(user.id),
      username: user.username,
      isAdmin: Boolean(user.isAdmin)
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }

  return req.headers['x-auth-token'] || req.query.token || null;
}

function applySlidingWindowLimit(bucketMap, key, limit, windowMs) {
  const now = Date.now();
  const bucket = bucketMap.get(key) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= limit) {
    bucketMap.set(key, recent);
    return false;
  }

  recent.push(now);
  bucketMap.set(key, recent);
  return true;
}

function addMessageToHistory(roomKey, message) {
  const existing = messageHistory.get(roomKey) || [];
  existing.push(message);
  if (existing.length > MAX_HISTORY_LENGTH) {
    existing.splice(0, existing.length - MAX_HISTORY_LENGTH);
  }
  messageHistory.set(roomKey, existing);
  queueMessageSave();
}

function addSystemMessage(roomKey, text, timestamp = Date.now(), shouldPersist = true) {
  const message = {
    type: 'system',
    text,
    timestamp
  };

  if (shouldPersist) {
    addMessageToHistory(roomKey, message);
  }

  io.to(roomKey).emit('system_message', {
    roomKey,
    text,
    timestamp
  });

  return message;
}

function broadcastUserList() {
  const users = Array.from(onlineUsers.values()).map((entry) => ({
    id: entry.id,
    username: entry.username,
    isAdmin: entry.isAdmin
  }));

  io.emit('user_list_update', users);
}

function parseMessagePayload(message) {
  if (typeof message !== 'string') {
    return null;
  }

  const trimmed = message.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  return trimmed;
}

async function initDataFiles() {
  await ensureFile(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  await ensureFile(MESSAGES_FILE, JSON.stringify({}, null, 2));
  usersCache = await loadUsers();
  messageHistory = await loadMessages();
}

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body || {};

  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters and use only letters, numbers, or underscores.' });
  }

  if (typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  const normalizedUsername = String(username).trim();
  if (findUserByUsername(normalizedUsername)) {
    return res.status(400).json({ error: 'Username already taken.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
      id: Date.now().toString(),
      username: normalizedUsername,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      isAdmin: false
    };

    usersCache.users.push(newUser);
    await saveUsers();

    const token = createToken(newUser);
    return res.json({
      success: true,
      token,
      user: makePublicUser(newUser)
    });
  } catch (error) {
    console.error('Signup failed:', error);
    return res.status(500).json({ error: 'Unable to create account.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = findUserByUsername(username);
  if (!user) {
    return res.status(400).json({ error: 'Invalid username or password.' });
  }

  try {
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const token = createToken(user);
    return res.json({
      success: true,
      token,
      user: makePublicUser(user)
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Unable to authenticate.' });
  }
});

app.get('/api/me', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    return res.json({
      success: true,
      user: makePublicUser(user)
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
});

app.get('/api/messages/:roomType/:roomId', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing token.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const roomKey = getRoomKey(req.params.roomType, req.params.roomId, decoded.userId);
  if (!roomKey) {
    return res.status(400).json({ error: 'Invalid room.' });
  }

  const messages = messageHistory.get(roomKey) || [];
  return res.json({
    roomKey,
    messages
  });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || extractToken({ headers: socket.handshake.headers, query: {} });

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.userId);

    if (!user) {
      return next(new Error('Invalid token'));
    }

    socket.user = makePublicUser(user);
    socket.userToken = token;
    return next();
  } catch (error) {
    return next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { id, username, isAdmin } = socket.user;

  onlineUsers.set(String(id), {
    id: String(id),
    username,
    isAdmin,
    socketId: socket.id
  });

  socket.emit('system_message', {
    roomKey: 'channel:general',
    text: `Welcome back, ${username}`,
    timestamp: Date.now()
  });

  CHANNELS.forEach((channelId) => {
    const roomKey = `channel:${channelId}`;
    addSystemMessage(roomKey, `${username} joined the server`);
  });

  socket.broadcast.emit('user_joined', {
    username,
    timestamp: Date.now()
  });

  broadcastUserList();

  socket.on('join_room', ({ type, id: roomId }) => {
    const roomKey = getRoomKey(type, roomId, socket.user.id);
    if (!roomKey) {
      return;
    }

    socket.join(roomKey);
  });

  socket.on('leave_room', ({ type, id: roomId }) => {
    const roomKey = getRoomKey(type, roomId, socket.user.id);
    if (!roomKey) {
      return;
    }

    socket.leave(roomKey);
  });

  socket.on('typing', ({ type, id: roomId, isTyping }) => {
    const roomKey = getRoomKey(type, roomId, socket.user.id);
    if (!roomKey) {
      return;
    }

    socket.to(roomKey).emit('typing', {
      roomKey,
      userId: socket.user.id,
      username,
      isTyping: Boolean(isTyping)
    });
  });

  socket.on('send_message', ({ type, id: roomId, message }, ack) => {
    const roomKey = getRoomKey(type, roomId, socket.user.id);
    const safeMessage = parseMessagePayload(message);

    if (!roomKey || !safeMessage) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Invalid message.' });
      }
      return;
    }

    if (!applySlidingWindowLimit(messageBuckets, socket.user.id, MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW_MS)) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'You are sending messages too quickly.' });
      }
      return;
    }

    const payload = {
      type: 'user',
      handle: username,
      text: safeMessage,
      timestamp: Date.now(),
      userId: socket.user.id,
      roomKey
    };

    addMessageToHistory(roomKey, payload);
    socket.to(roomKey).emit('new_message', payload);

    if (typeof ack === 'function') {
      ack({ ok: true, message: payload });
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(String(socket.user.id));
    broadcastUserList();
    socket.broadcast.emit('user_left', {
      username,
      timestamp: Date.now()
    });

    CHANNELS.forEach((channelId) => {
      const roomKey = `channel:${channelId}`;
      addSystemMessage(roomKey, `${username} left the server`);
    });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

initDataFiles()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🚀 SERVER RUNNING on http://localhost:${PORT}`);
      console.log(`${'='.repeat(50)}`);
      console.log(`📝 Ready for signups and logins!\n`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data files:', error);
    process.exit(1);
  });

// Middleware to protect routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Change Username
app.post('/api/user/username', authenticateToken, async (req, res) => {
    const { newUsername } = req.body;
    const userId = req.user.id;

    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length < 3) {
        return res.status(400).json({ error: 'Invalid username.' });
    }

    const user = usersCache.users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    // Check if username is already taken
    if (usersCache.users.some(u => u.username.toLowerCase() === newUsername.trim().toLowerCase() && u.id !== userId)) {
        return res.status(409).json({ error: 'Username is already taken.' });
    }

    user.username = newUsername.trim();
    await saveUsers();
    
    // Optionally, broadcast this change to other users
    io.emit('user_updated', { id: userId, username: user.username });

    res.json({ message: 'Username updated successfully.' });
});

// Change Password
app.post('/api/user/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Invalid password data.' });
    }

    const user = usersCache.users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.status(403).json({ error: 'Incorrect current password.' });
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await saveUsers();

    res.json({ message: 'Password updated successfully.' });
});