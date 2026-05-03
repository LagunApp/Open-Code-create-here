const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load profiles into memory at startup
let profiles = [];
let users = [];
let messages = [];
let groups = [];
async function loadData() {
  try {
    const rawP = await fs.readFile(PROFILES_FILE, 'utf8');
    profiles = JSON.parse(rawP);
  } catch (err) {
    console.warn('Could not load profiles:', err.message);
    profiles = [];
  }
  try {
    const rawU = await fs.readFile(USERS_FILE, 'utf8');
    users = JSON.parse(rawU);
  } catch (err) {
    console.warn('Could not load users:', err.message);
    users = [];
  }
  try {
    const rawM = await fs.readFile(MESSAGES_FILE, 'utf8');
    messages = JSON.parse(rawM);
  } catch (err) {
    console.warn('Could not load messages:', err.message);
    messages = [];
  }
  try {
    const rawG = await fs.readFile(GROUPS_FILE, 'utf8');
    groups = JSON.parse(rawG);
  } catch (err) {
    console.warn('Could not load groups:', err.message);
    groups = [];
  }
}

async function saveAll() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
    await fs.writeFile(GROUPS_FILE, JSON.stringify(groups, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save data:', err);
  }
}

// Public: fetch profiles
app.get('/api/profiles', (req, res) => {
  res.json(profiles);
});

// User registration
app.post('/api/register', async (req, res) => {
  const { username, password, profile } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'username taken' });
  const hash = await bcrypt.hash(password, 8);
  const user = { id: Date.now().toString(36), username, passwordHash: hash, profileId: null };
  // create profile from provided profile data
  if (profile && profile.name) {
    const p = Object.assign({}, profile);
    p.id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    p.createdAt = new Date().toISOString();
    profiles.push(p);
    user.profileId = p.id;
  }
  users.push(user);
  await saveAll();
  // return a simple token (not secure for production)
  const token = Buffer.from(user.id + ':' + user.username).toString('base64');
  res.json({ token, user: { id: user.id, username: user.username, profileId: user.profileId } });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(400).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'invalid credentials' });
  const token = Buffer.from(user.id + ':' + user.username).toString('base64');
  res.json({ token, user: { id: user.id, username: user.username, profileId: user.profileId } });
});

// Create or update profile (authenticated via token header)
function authFromReq(req) {
  const auth = req.headers['authorization'];
  if (!auth) return null;
  try {
    const b = Buffer.from(auth.replace('Bearer ', ''), 'base64').toString();
    const [id, username] = b.split(':');
    return users.find(u => u.id === id && u.username === username) || null;
  } catch (err) { return null; }
}

app.post('/api/profile', async (req, res) => {
  const user = authFromReq(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const p = req.body;
  if (!p || !p.name) return res.status(400).json({ error: 'profile must include name' });
  // if user has profileId update, else create
  if (user.profileId) {
    const existing = profiles.find(x => x.id === user.profileId);
    Object.assign(existing, p);
    await saveAll();
    return res.json(existing);
  } else {
    p.id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    p.createdAt = new Date().toISOString();
    profiles.push(p);
    user.profileId = p.id;
    await saveAll();
    io.emit('new-profile', p);
    return res.status(201).json(p);
  }
});

// Messages
app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.post('/api/messages', async (req, res) => {
  const user = authFromReq(req);
  const text = req.body && req.body.text;
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!text) return res.status(400).json({ error: 'text required' });
  const m = { id: Date.now().toString(36), from: user.username, text, createdAt: new Date().toISOString() };
  messages.push(m);
  await saveAll();
  io.emit('message', m);
  res.status(201).json(m);
});

// Groups
app.get('/api/groups', (req, res) => {
  res.json(groups);
});

app.post('/api/groups', async (req, res) => {
  const user = authFromReq(req);
  const name = req.body && req.body.name;
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!name) return res.status(400).json({ error: 'name required' });
  const g = { id: Date.now().toString(36), name, members: [user.id], createdAt: new Date().toISOString() };
  groups.push(g);
  await saveAll();
  io.emit('group', g);
  res.status(201).json(g);
});


io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

(async () => {
  await loadProfiles();
  server.listen(PORT, () => {
    console.log(`LagunApp server running on http://localhost:${PORT}`);
  });
})();
