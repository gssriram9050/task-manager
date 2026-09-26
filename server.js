import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();

app.use(cors());

// Body parser middleware supporting pre-parsed req.body from worker.js adapter
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json()(req, res, (err) => {
    if (err) req.body = {};
    next();
  });
});

app.use(express.urlencoded({ extended: true }));

// Token generator and helper
function generateToken(user) {
  const payload = `${user.id}:${user.email}:${Date.now()}`;
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(payload).toString('base64')
    : btoa(payload);
  return `tf_token_${base64}`;
}

function parseToken(token) {
  if (!token || !token.startsWith('tf_token_')) return null;
  const base64 = token.replace('tf_token_', '');
  try {
    const raw = typeof Buffer !== 'undefined'
      ? Buffer.from(base64, 'base64').toString('utf-8')
      : atob(base64);
    const parts = raw.split(':');
    if (parts.length >= 2) {
      return { id: parseInt(parts[0], 10), email: parts[1] };
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Authentication Middleware
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const tokenData = parseToken(token);
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const env = req.env || null;
    const user = await db.findUserById(tokenData.id, env);
    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed: ' + err.message });
  }
}

// System Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'task-manager',
    timestamp: new Date().toISOString()
  });
});

// System Info Endpoint
app.get(['/api/system/info', '/api/system/info/'], async (req, res) => {
  try {
    const env = req.env || null;
    const info = await db.getSystemInfo(env);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve system info: ' + err.message });
  }
});

// User Registration
app.post(['/api/auth/register', '/api/auth/register/'], async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const env = req.env || null;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ error: 'Please provide your full name (at least 3 characters).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await db.findUserByEmail(cleanEmail, env);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please log in.' });
    }

    const newUser = await db.createUser(cleanEmail, name.trim(), password, env);
    const token = generateToken(newUser);

    res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      },
      token
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// User Login (Strict Registration Check)
app.post(['/api/auth/login', '/api/auth/login/'], async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const env = req.env || null;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail, env);
    if (!user) {
      return res.status(401).json({ error: 'User not registered. Please sign up first.' });
    }

    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Get Current User Profile
app.get(['/api/auth/me', '/api/auth/me/'], authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

// Task Operations - Get User Tasks (Strict Per-User Scoping)
app.get(['/api/tasks', '/api/tasks/'], authMiddleware, async (req, res) => {
  try {
    const env = req.env || null;
    const tasks = await db.getUserTasks(req.user.id, env);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks: ' + err.message });
  }
});

// Task Operations - Create Task
app.post(['/api/tasks', '/api/tasks/'], authMiddleware, async (req, res) => {
  try {
    const { title, priority, dueDate, completed } = req.body || {};
    const env = req.env || null;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const task = await db.createTask(
      taskId,
      req.user.id,
      title.trim(),
      priority || 'Medium',
      dueDate || null,
      Boolean(completed),
      env
    );

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task: ' + err.message });
  }
});

// Task Operations - Update Task
app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, priority, dueDate } = req.body || {};
    const env = req.env || null;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const existing = await db.getTaskById(id, req.user.id, env);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found or unauthorized.' });
    }

    const updated = await db.updateTask(id, req.user.id, title.trim(), priority || 'Medium', dueDate || null, env);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task: ' + err.message });
  }
});

// Task Operations - Toggle Completed
app.patch('/api/tasks/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body || {};
    const env = req.env || null;

    const existing = await db.getTaskById(id, req.user.id, env);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found or unauthorized.' });
    }

    const targetCompleted = typeof completed !== 'undefined' ? Boolean(completed) : !existing.completed;
    const updated = await db.toggleTask(id, req.user.id, targetCompleted, env);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle task completion: ' + err.message });
  }
});

// Task Operations - Delete Task
app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const env = req.env || null;

    const existing = await db.getTaskById(id, req.user.id, env);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found or unauthorized.' });
    }

    await db.deleteTask(id, req.user.id, env);
    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task: ' + err.message });
  }
});

// Catch-all 404 handler for API routes to guarantee JSON output
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Express Error Handler Middleware to guarantee JSON output
app.use((err, req, res, next) => {
  console.error('Express Internal Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Local Node.js standalone server runner
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'test' && !process.env.WORKER) {
  const PORT = process.env.PORT || 5000;
  if (process.argv[1] && process.argv[1].endsWith('server.js')) {
    db.initDb().then(() => {
      app.listen(PORT, () => {
        console.log(`Task Manager Server running at http://localhost:${PORT}`);
      });
    }).catch(err => {
      console.error('Database initialization error:', err);
    });
  }
}

export default app;
