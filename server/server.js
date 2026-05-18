const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

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
const ADMIN_JWT_SECRET = 'index0-admin-secret-key-2024';
const SALT_ROUNDS = 10;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_LENGTH = 200;
const MESSAGE_RATE_LIMIT = 5;
const MESSAGE_RATE_WINDOW_MS = 2000;
const AUTH_RATE_LIMIT = 8;
const AUTH_RATE_WINDOW_MS = 60 * 1000;
const CHANNELS = ['general', 'rules', 'random', 'tech', 'member-activity'];

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
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..')));

// New endpoint to capture client-side logs
app.post('/api/log', (req, res) => {
    const { level, message, context } = req.body;

    // Add a check to ensure level is defined
    if (!level) {
        // This could be a preflight OPTIONS request, so we'll just send a success status.
        return res.sendStatus(204);
    }

    const timestamp = new Date().toISOString();
    
    // Log to server console with color coding
    const colors = {
        log: '\x1b[37m', // white
        error: '\x1b[31m', // red
        warn: '\x1b[33m', // yellow
        info: '\x1b[36m', // cyan
        debug: '\x1b[35m' // magenta
    };
    const color = colors[level] || colors.log;
    
    console.log(`${color}[CLIENT ${level.toUpperCase()}] ${timestamp}: ${message}\x1b[0m`);
    if (context) {
        console.log(JSON.stringify(context, null, 2));
    }
    
    res.sendStatus(204);
});

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
      nickname: user.nickname,
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
    nickname: user.nickname,
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

function createAdminToken(user) {
    return jwt.sign(
        { userId: String(user.id), username: user.username, isAdmin: true },
        ADMIN_JWT_SECRET,
        { expiresIn: '1h' }
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
    nickname: entry.nickname,
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
      isAdmin: normalizedUsername.toLowerCase() === 'kiri'
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

app.post('/api/validate', (req, res) => {
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

app.put('/api/user/nickname', (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = findUserById(decoded.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { nickname } = req.body;
        const newNickname = (nickname || '').trim();

        if (newNickname.length > 20) {
            return res.status(400).json({ error: 'Display name is too long.' });
        }

        user.nickname = newNickname || null;
        saveUsers();

        // Update online user cache
        if (onlineUsers.has(String(user.id))) {
            onlineUsers.get(String(user.id)).nickname = user.nickname;
        }

        io.emit('user_updated', makePublicUser(user));

        res.json({ success: true, user: makePublicUser(user) });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
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

// Admin routes
const adminRouter = express.Router();

adminRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'Kiri' && password === 'Shl1nkzy26!') {
        const user = findUserByUsername(username);
        if (user && user.isAdmin) {
            const token = createAdminToken(user);
            return res.json({ success: true, token });
        }
    }
    res.status(401).json({ error: 'Invalid admin credentials' });
});

function authenticateAdmin(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, ADMIN_JWT_SECRET, (err, user) => {
        if (err || !user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
}

app.get('/api/users', authenticateAdmin, (req, res) => {
    res.json(usersCache.users.map(u => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt
    })));
});


app.use('/api/admin', adminRouter);


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
  const { id, username, isAdmin, nickname } = socket.user;

  onlineUsers.set(String(id), {
    id: String(id),
    username,
    nickname,
    isAdmin,
    socketId: socket.id
  });

  socket.emit('system_message', {
    roomKey: 'channel:general',
    text: `Welcome back, ${nickname || username}`,
    timestamp: Date.now()
  });

  const activityRoomKey = 'channel:member-activity';
  addSystemMessage(activityRoomKey, `${nickname || username} joined the server`);

  socket.broadcast.emit('user_joined', {
    username,
    onlineUsers: Array.from(onlineUsers.values()).map(makePublicUser),
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
      username: socket.user.nickname || socket.user.username,
      isTyping: Boolean(isTyping)
    });
  });

  socket.on('send_message', ({ type, id: roomId, text, clientId }, ack) => {
    const roomKey = getRoomKey(type, roomId, socket.user.id);
    const safeMessage = parseMessagePayload(text);

    if (!roomKey || !safeMessage) {
      if (typeof ack === 'function') {
        ack({ success: false, error: 'Invalid message.' });
      }
      return;
    }

    const channel = CHANNELS.find(c => c.id === roomId);
    if (type === 'channel' && channel && channel.isReadOnly) {
        if (typeof ack === 'function') {
            ack({ success: false, error: 'This channel is read-only.' });
        }
        return;
    }

    if (!applySlidingWindowLimit(messageBuckets, socket.user.id, MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW_MS)) {
      if (typeof ack === 'function') {
        ack({ success: false, error: 'You are sending messages too quickly.' });
      }
      return;
    }

    const payload = {
      type: 'user',
      handle: socket.user.nickname || socket.user.username,
      text: safeMessage,
      timestamp: Date.now(),
      userId: socket.user.id,
    };
    
    const fullMessage = { ...payload, roomKey };

    addMessageToHistory(roomKey, payload);
    
    // Echo back to sender
    socket.emit('new_message', fullMessage);
    // Broadcast to others in the room
    socket.to(roomKey).emit('new_message', fullMessage);

    if (typeof ack === 'function') {
      ack({ success: true, clientId });
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(String(socket.user.id));
    broadcastUserList();
    
    const activityRoomKey = 'channel:member-activity';
    addSystemMessage(activityRoomKey, `${socket.user.nickname || username} left the server`);

    socket.broadcast.emit('user_left', {
      username,
      onlineUsers: Array.from(onlineUsers.values()).map(makePublicUser),
      timestamp: Date.now()
    });
  });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
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

// Change Nickname
app.post('/api/user/nickname', authenticateToken, async (req, res) => {
    const { nickname } = req.body;
    const userId = req.user.userId;

    if (typeof nickname !== 'string' || nickname.trim().length > 32) {
        return res.status(400).json({ error: 'Invalid display name.' });
    }

    const user = findUserById(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    user.nickname = nickname.trim();
    await saveUsers();
    
    const publicUser = makePublicUser(user);
    onlineUsers.set(String(userId), { ...onlineUsers.get(String(userId)), nickname: user.nickname });
    
    io.emit('user_updated', publicUser);
    broadcastUserList();

    res.json({ message: 'Display name updated successfully.', user: publicUser });
});

// Change Password
app.post('/api/user/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Invalid password data.' });
    }

    const user = findUserById(userId);
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