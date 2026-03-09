const path = require('path');
const { App } = require('@tinyhttp/app');
const cors = require('@tinyhttp/cors');
const { json } = require('milliparsec');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const jwt = require('jsonwebtoken');

const DB_PATH = path.join(__dirname, 'db.json');
const SECRET_KEY = 'nnptud-c2-secret-key';
const TOKEN_EXPIRES_IN = '2h';

async function createServer() {
  const adapter = new JSONFile(DB_PATH);
  const db = new Low(adapter);
  await db.read();
  db.data = db.data || { posts: [], comments: [], users: [] };

  const app = new App();
  app.use(cors());
  app.use(json());

  function saveDb() {
    return db.write();
  }

  function createToken(payload) {
    return jwt.sign(payload, SECRET_KEY, { expiresIn: TOKEN_EXPIRES_IN });
  }

  function verifyToken(token) {
    return jwt.verify(token, SECRET_KEY);
  }

  function getAuthToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split(' ')[1];
  }

  function getAuthUser(req) {
    const token = getAuthToken(req);
    if (!token) return null;
    try {
      return verifyToken(token);
    } catch {
      return null;
    }
  }

  function requireAuth(req, res, next) {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  }

  function requireRole(allowedRoles) {
    return (req, res, next) => {
      const user = req.user;
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };
  }

  // Public
  app.get('/posts', (req, res) => {
    res.json(db.data.posts || []);
  });

  app.get('/posts/:id', (req, res) => {
    const post = (db.data.posts || []).find(p => String(p.id) === String(req.params.id));
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
  });

  // Auth endpoints
  app.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = (db.data.users || []).find(u => u.username === username && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = createToken({ id: user.id, username: user.username, role: user.role });
    res.json({ accessToken: token, user: { id: user.id, username: user.username, role: user.role } });
  });

  app.post('/change-password', requireAuth, async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'oldPassword and newPassword are required' });
    }
    const user = (db.data.users || []).find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.password !== oldPassword) {
      return res.status(400).json({ error: 'Old password does not match' });
    }
    user.password = newPassword;
    await saveDb();
    res.json({ success: true });
  });

  // Posts CRUD
  app.post('/posts', requireAuth, requireRole(['admin', 'mod']), async (req, res) => {
    const item = req.body;
    const posts = db.data.posts || [];
    posts.push(item);
    await saveDb();
    res.status(201).json(item);
  });

  app.put('/posts/:id', requireAuth, requireRole(['admin', 'mod']), async (req, res) => {
    const posts = db.data.posts || [];
    const idx = posts.findIndex(p => String(p.id) === String(req.params.id));
    if (idx === -1) {
      return res.status(404).json({ error: 'Not found' });
    }
    posts[idx] = { ...posts[idx], ...req.body };
    await saveDb();
    res.json(posts[idx]);
  });

  app.delete('/posts/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    const posts = db.data.posts || [];
    const idx = posts.findIndex(p => String(p.id) === String(req.params.id));
    if (idx === -1) {
      return res.status(404).json({ error: 'Not found' });
    }
    posts.splice(idx, 1);
    await saveDb();
    res.status(204).end();
  });

  // Comments CRUD (authenticated access)
  app.get('/comments', requireAuth, (req, res) => {
    res.json(db.data.comments || []);
  });

  app.post('/comments', requireAuth, async (req, res) => {
    const item = req.body;
    const comments = db.data.comments || [];
    comments.push(item);
    await saveDb();
    res.status(201).json(item);
  });

  app.put('/comments/:id', requireAuth, async (req, res) => {
    const comments = db.data.comments || [];
    const idx = comments.findIndex(c => String(c.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    comments[idx] = { ...comments[idx], ...req.body };
    await saveDb();
    res.json(comments[idx]);
  });

  app.delete('/comments/:id', requireAuth, async (req, res) => {
    const comments = db.data.comments || [];
    const idx = comments.findIndex(c => String(c.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    comments.splice(idx, 1);
    await saveDb();
    res.status(204).end();
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

createServer();
