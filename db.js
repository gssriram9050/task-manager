let pgPool = null;

// In-memory store fallback for zero-dependency local Node execution / isolation
const localMemoryStore = {
  users: [
    { id: 1, email: 'user@example.com', name: 'TaskFlow User', password_hash: 'password123', created_at: new Date().toISOString() }
  ],
  tasks: [
    { id: 'task-seed-1', user_id: 1, title: 'Complete Thiranex Task Management Project', priority: 'High', due_date: new Date().toISOString().split('T')[0], completed: false, created_at: new Date().toISOString() },
    { id: 'task-seed-2', user_id: 1, title: 'Verify PostgreSQL & D1 Edge Database Integration', priority: 'High', due_date: new Date().toISOString().split('T')[0], completed: false, created_at: new Date().toISOString() },
    { id: 'task-seed-3', user_id: 1, title: 'Review Responsive Task Manager UI & Dark Mode Theme', priority: 'Medium', due_date: new Date().toISOString().split('T')[0], completed: true, created_at: new Date().toISOString() }
  ]
};

function getD1(env) {
  if (!env || typeof env !== 'object') return null;
  return env.DB || env.D1 || env.DATABASE || null;
}

function getDbConfig(env) {
  let connectionString = null;
  if (env && typeof env === 'object') {
    connectionString = env.DATABASE_URL || env.POSTGRES_URL;
  }
  if (!connectionString && typeof process !== 'undefined' && process.env) {
    connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  }
  const isPostgres = Boolean(connectionString);
  return { connectionString, isPostgres };
}

async function getPgPool(env) {
  if (pgPool) return pgPool;
  const { connectionString } = getDbConfig(env);
  if (connectionString) {
    try {
      const pgModule = await import('pg');
      const Pool = pgModule.default?.Pool || pgModule.Pool;
      if (Pool) {
        pgPool = new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false }
        });
      }
    } catch (err) {
      console.warn('PostgreSQL pool creation warning:', err.message);
    }
  }
  return pgPool;
}

export function query(sql, params = [], env = null) {
  return new Promise(async (resolve) => {
    const { connectionString, isPostgres } = getDbConfig(env);

    if (isPostgres || connectionString) {
      try {
        const pool = await getPgPool(env);
        if (!pool) {
          return resolve([]);
        }
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        pool.query(pgSql, params, (err, res) => {
          if (err) {
            console.warn('PostgreSQL query error:', err.message);
            return resolve([]);
          }
          resolve(res.rows || []);
        });
      } catch (err) {
        console.warn('PostgreSQL execution catch:', err.message);
        return resolve([]);
      }
    } else {
      resolve([]);
    }
  });
}

export async function initDb(env = null) {
  const d1 = getD1(env);
  const { connectionString } = getDbConfig(env);

  if (d1) {
    try {
      await d1.prepare(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();

      await d1.prepare(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        priority TEXT DEFAULT 'Medium',
        due_date TEXT,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();

      const userCountRes = await d1.prepare('SELECT COUNT(*) as count FROM users').first();
      if (!userCountRes || userCountRes.count === 0) {
        await seedInitialDataD1(d1);
      }
    } catch (err) {
      console.warn('D1 Database init warning:', err.message);
    }
    return;
  }

  if (connectionString) {
    const createTablesSql = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        priority TEXT DEFAULT 'Medium',
        due_date TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`
    ];

    for (const sql of createTablesSql) {
      await query(sql, [], env);
    }

    await seedInitialDataPg(env);
  }
}

async function seedInitialDataD1(d1) {
  try {
    await d1.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').bind(
      'user@example.com', 'TaskFlow User', 'password123'
    ).run();

    const user = await d1.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').bind('user@example.com').first();
    if (user && user.id) {
      const initialTasks = [
        { id: 'task-seed-1', user_id: user.id, title: 'Complete Thiranex Task Management Project', priority: 'High', due_date: new Date().toISOString().split('T')[0], completed: 0 },
        { id: 'task-seed-2', user_id: user.id, title: 'Verify Edge D1 & PostgreSQL Database Integration', priority: 'High', due_date: new Date().toISOString().split('T')[0], completed: 0 },
        { id: 'task-seed-3', user_id: user.id, title: 'Review Responsive Task Manager UI & Dark Mode Theme', priority: 'Medium', due_date: new Date().toISOString().split('T')[0], completed: 1 }
      ];
      for (const t of initialTasks) {
        await d1.prepare('INSERT INTO tasks (id, user_id, title, priority, due_date, completed) VALUES (?, ?, ?, ?, ?, ?)').bind(
          t.id, t.user_id, t.title, t.priority, t.due_date, t.completed
        ).run();
      }
    }
  } catch (e) {
    console.warn('D1 Seeding warning:', e.message);
  }
}

async function seedInitialDataPg(env = null) {
  try {
    const usersCount = await query('SELECT COUNT(*) as count FROM users', [], env);
    const countVal = parseInt(usersCount[0]?.count || usersCount[0]?.COUNT || 0, 10);
    if (countVal === 0) {
      await query(
        `INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`,
        ['user@example.com', 'TaskFlow User', 'password123'],
        env
      );

      const demoUser = await query('SELECT * FROM users WHERE email = ?', ['user@example.com'], env);
      if (demoUser && demoUser.length > 0) {
        const userId = demoUser[0].id;
        const initialTasks = [
          { id: 'task-seed-1', user_id: userId, title: 'Complete Thiranex Task Management Project', priority: 'High', due_date: new Date().toISOString().split('T')[0], completed: false },
          { id: 'task-seed-2', user_id: userId, title: 'Verify Edge D1 & PostgreSQL Database Integration', priority: 'High', due_date: new Date().toISOString().split('T')[0], completed: false },
          { id: 'task-seed-3', user_id: userId, title: 'Review Responsive Task Manager UI & Dark Mode Theme', priority: 'Medium', due_date: new Date().toISOString().split('T')[0], completed: true }
        ];

        for (const t of initialTasks) {
          await query(
            `INSERT INTO tasks (id, user_id, title, priority, due_date, completed) VALUES (?, ?, ?, ?, ?, ?)`,
            [t.id, t.user_id, t.title, t.priority, t.due_date, t.completed],
            env
          );
        }
      }
    }
  } catch (err) {
    console.warn('Postgres Seeding notice:', err.message);
  }
}

export async function findUserByEmail(email, env = null) {
  const d1 = getD1(env);
  if (d1) {
    const row = await d1.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').bind(email.trim().toLowerCase()).first();
    return row || null;
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    const rows = await query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim().toLowerCase()], env);
    return rows[0] || null;
  }

  return localMemoryStore.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

export async function findUserById(id, env = null) {
  const d1 = getD1(env);
  if (d1) {
    const row = await d1.prepare('SELECT * FROM users WHERE id = ?').bind(Number(id)).first();
    return row || null;
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    const rows = await query('SELECT * FROM users WHERE id = ?', [Number(id)], env);
    return rows[0] || null;
  }

  return localMemoryStore.users.find(u => Number(u.id) === Number(id)) || null;
}

export async function createUser(email, name, password, env = null) {
  const cleanEmail = email.trim().toLowerCase();
  const d1 = getD1(env);
  if (d1) {
    await d1.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').bind(
      cleanEmail, name.trim(), password
    ).run();
    return await findUserByEmail(cleanEmail, env);
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    await query(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [cleanEmail, name.trim(), password],
      env
    );
    return await findUserByEmail(cleanEmail, env);
  }

  const newUser = {
    id: localMemoryStore.users.length + 100,
    email: cleanEmail,
    name: name.trim(),
    password_hash: password,
    created_at: new Date().toISOString()
  };
  localMemoryStore.users.push(newUser);
  return newUser;
}

export async function getUserTasks(userId, env = null) {
  const d1 = getD1(env);
  if (d1) {
    const res = await d1.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').bind(Number(userId)).all();
    const rows = res.results || [];
    return rows.map(r => ({ ...r, completed: Boolean(r.completed) }));
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    const rows = await query(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
      [Number(userId)],
      env
    );
    return rows.map(r => ({
      ...r,
      completed: Boolean(r.completed)
    }));
  }

  return localMemoryStore.tasks.filter(t => Number(t.user_id) === Number(userId));
}

export async function getTaskById(taskId, userId, env = null) {
  const d1 = getD1(env);
  if (d1) {
    const row = await d1.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(String(taskId), Number(userId)).first();
    if (!row) return null;
    return { ...row, completed: Boolean(row.completed) };
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    const rows = await query(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [String(taskId), Number(userId)],
      env
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      completed: Boolean(rows[0].completed)
    };
  }

  return localMemoryStore.tasks.find(t => String(t.id) === String(taskId) && Number(t.user_id) === Number(userId)) || null;
}

export async function createTask(id, userId, title, priority, dueDate, completed, env = null) {
  const d1 = getD1(env);
  if (d1) {
    await d1.prepare('INSERT INTO tasks (id, user_id, title, priority, due_date, completed) VALUES (?, ?, ?, ?, ?, ?)').bind(
      String(id), Number(userId), title.trim(), priority || 'Medium', dueDate || null, completed ? 1 : 0
    ).run();
    return await getTaskById(id, userId, env);
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    await query(
      'INSERT INTO tasks (id, user_id, title, priority, due_date, completed) VALUES (?, ?, ?, ?, ?, ?)',
      [String(id), Number(userId), title.trim(), priority || 'Medium', dueDate || null, Boolean(completed)],
      env
    );
    return await getTaskById(id, userId, env);
  }

  const newTask = {
    id: String(id),
    user_id: Number(userId),
    title: title.trim(),
    priority: priority || 'Medium',
    due_date: dueDate || null,
    completed: Boolean(completed),
    created_at: new Date().toISOString()
  };
  localMemoryStore.tasks.unshift(newTask);
  return newTask;
}

export async function updateTask(id, userId, title, priority, dueDate, env = null) {
  const d1 = getD1(env);
  if (d1) {
    await d1.prepare('UPDATE tasks SET title = ?, priority = ?, due_date = ? WHERE id = ? AND user_id = ?').bind(
      title.trim(), priority || 'Medium', dueDate || null, String(id), Number(userId)
    ).run();
    return await getTaskById(id, userId, env);
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    await query(
      'UPDATE tasks SET title = ?, priority = ?, due_date = ? WHERE id = ? AND user_id = ?',
      [title.trim(), priority || 'Medium', dueDate || null, String(id), Number(userId)],
      env
    );
    return await getTaskById(id, userId, env);
  }

  const task = await getTaskById(id, userId, env);
  if (task) {
    task.title = title.trim();
    task.priority = priority || 'Medium';
    task.due_date = dueDate || null;
  }
  return task;
}

export async function toggleTask(id, userId, completed, env = null) {
  const d1 = getD1(env);
  if (d1) {
    await d1.prepare('UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?').bind(
      completed ? 1 : 0, String(id), Number(userId)
    ).run();
    return await getTaskById(id, userId, env);
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    await query(
      'UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?',
      [Boolean(completed), String(id), Number(userId)],
      env
    );
    return await getTaskById(id, userId, env);
  }

  const task = await getTaskById(id, userId, env);
  if (task) {
    task.completed = Boolean(completed);
  }
  return task;
}

export async function deleteTask(id, userId, env = null) {
  const d1 = getD1(env);
  if (d1) {
    await d1.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(String(id), Number(userId)).run();
    return { success: true };
  }

  const { isPostgres } = getDbConfig(env);
  if (isPostgres) {
    await query(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [String(id), Number(userId)],
      env
    );
  } else {
    localMemoryStore.tasks = localMemoryStore.tasks.filter(t => !(String(t.id) === String(id) && Number(t.user_id) === Number(userId)));
  }
  return { success: true };
}

export async function getSystemInfo(env = null) {
  const d1 = getD1(env);
  const { isPostgres } = getDbConfig(env);

  let dbEngine = 'Multi-User Relational Engine';
  let totalUsers = localMemoryStore.users.length;
  let totalTasks = localMemoryStore.tasks.length;

  if (d1) {
    dbEngine = 'Cloudflare D1 (Edge SQLite)';
    try {
      const uRes = await d1.prepare('SELECT COUNT(*) as count FROM users').first();
      const tRes = await d1.prepare('SELECT COUNT(*) as count FROM tasks').first();
      totalUsers = uRes ? uRes.count : 0;
      totalTasks = tRes ? tRes.count : 0;
    } catch (e) {}
  } else if (isPostgres) {
    dbEngine = 'PostgreSQL Database';
    try {
      const uRes = await query('SELECT COUNT(*) as count FROM users', [], env);
      const tRes = await query('SELECT COUNT(*) as count FROM tasks', [], env);
      totalUsers = parseInt(uRes[0]?.count || uRes[0]?.COUNT || 0, 10);
      totalTasks = parseInt(tRes[0]?.count || tRes[0]?.COUNT || 0, 10);
    } catch (e) {}
  }

  return {
    status: 'online',
    dbEngine,
    totalUsers,
    totalTasks,
    version: '3.0.0-fullstack'
  };
}

export default {
  query,
  initDb,
  findUserByEmail,
  findUserById,
  createUser,
  getUserTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleTask,
  deleteTask,
  getSystemInfo
};
