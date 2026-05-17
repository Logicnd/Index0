const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Simple test endpoint
app.post('/api/signup', (req, res) => {
  console.log('Signup request:', req.body);
  res.json({
    success: true,
    token: 'test-token-123',
    user: {
      id: '1',
      username: req.body.username,
      isAdmin: false
    }
  });
});

app.post('/api/login', (req, res) => {
  console.log('Login request:', req.body);
  res.json({
    success: true,
    token: 'test-token-123',
    user: {
      id: '1',
      username: req.body.username,
      isAdmin: false
    }
  });
});

io.on('connection', (socket) => {
  console.log('New client connected!');
  
  socket.emit('system_message', {
    text: 'Welcome to the chat!',
    timestamp: Date.now()
  });
  
  socket.on('join_room', (data) => {
    console.log('Join room:', data);
    socket.join(`${data.type}:${data.id}`);
  });
  
  socket.on('send_message', (data) => {
    console.log('Message:', data);
    io.to(`${data.type}:${data.id}`).emit('new_message', {
      type: 'user',
      handle: socket.user?.username || 'Anonymous',
      text: data.message,
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Simple auth middleware
io.use((socket, next) => {
  socket.user = { username: 'TestUser', userId: '1' };
  next();
});

server.listen(PORT, () => {
  console.log(`\n🚀 Test server running on http://localhost:${PORT}`);
  console.log('Open your browser and test the connection\n');
});