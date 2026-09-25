let pgPool = null;

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
  return new Promise(async (resolve, reject) => {
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
      // Local Node.js SQLite fallback
      try {
        if (typeof process !== 'undefined' && process.versions && process.versions.node && !process.versions.workerd) {
          const path = await import('path');
          const { fileURLToPath } = await import('url');
          const sqlite3Module = await import('sqlite3');
          const sqlite3 = sqlite3Module.default || sqlite3Module;
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const dbPath = path.join(__dirname, 'taskmanager.db');
          const sqliteDb = new sqlite3.verbose().Database(dbPath);

          const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
          if (isSelect) {
            sqliteDb.all(sql, params, (err, rows) => {
              if (err) return resolve([]);
              resolve(rows || []);
            });
          } else {
            sqliteDb.run(sql, params, function (err) {
              if (err) return resolve([]);
              resolve({ lastID: this.lastID, changes: this.changes });
            });
          }
        } else {
          return resolve([]);
        }
      } catch (err) {
        return resolve([]);
      }
    }
  });
}

export async function initDb(env = null) {
  const { connectionString } = getDbConfig(env);
  const usePostgres = Boolean(connectionString);

  const createTablesSql = [
    `CREATE TABLE IF NOT EXISTS users (
      id ${usePostgres ? 'INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
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
      completed ${usePostgres ? 'BOOLEAN' : 'INTEGER'} DEFAULT ${usePostgres ? 'FALSE' : '0'},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  ];

  for (const sql of createTablesSql) {
    await query(sql, [], env);
  }

  await seedInitialData(env);
}

async function seedInitialData(env = null) {
  try {
    const usersCount = await query('SELECT COUNT(*) as count FROM users', [], env);
    const countVal = parseInt(usersCount[0]?.count || usersCount[0]?.COUNT || 0, 10);
    if (countVal === 0) {
      // Create default demo user
      await query(
        `INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`,
        ['user@example.com', 'TaskFlow User', 'password123'],
        env
      );

      const demoUser = await query('SELECT * FROM users WHERE email = ?', ['user@example.com'], env);
      if (demoUser && demoUser.length > 0) {
        const userId = demoUser[0].id;
        const initialTasks = [
          {
            id: 'task-seed-1',
            user_id: userId,
            title: 'Complete Thiranex Task Management Project',
            priority: 'High',
            due_date: new Date().toISOString().split('T')[0],
            completed: false
          },
          {
            id: 'task-seed-2',
            user_id: userId,
            title: 'Verify PostgreSQL Database & Cloudflare Worker Deployment',
            priority: 'High',
            due_date: new Date().toISOString().split('T')[0],
            completed: false
          },
          {
            id: 'task-seed-3',
            user_id: userId,
            title: 'Review Responsive Task Manager UI & Dark Mode Theme',
            priority: 'Medium',
            due_date: new Date().toISOString().split('T')[0],
            completed: true
          }
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
    console.warn('Task manager seeding notice:', err.message);
  }
}

export async function findUserByEmail(email, env = null) {
  const rows = await query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email], env);
  return rows[0] || null;
}

export async function findUserById(id, env = null) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id], env);
  return rows[0] || null;
}

export async function createUser(email, name, password, env = null) {
  await query(
    'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
    [email, name, password],
    env
  );
  return await findUserByEmail(email, env);
}

export async function getUserTasks(userId, env = null) {
  const rows = await query(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    env
  );
  return rows.map(r => ({
    ...r,
    completed: Boolean(r.completed)
  }));
}

export async function getTaskById(taskId, userId, env = null) {
  const rows = await query(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
    [taskId, userId],
    env
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    completed: Boolean(rows[0].completed)
  };
}

export async function createTask(id, userId, title, priority, dueDate, completed, env = null) {
  await query(
    'INSERT INTO tasks (id, user_id, title, priority, due_date, completed) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, title, priority, dueDate || null, Boolean(completed)],
    env
  );
  return await getTaskById(id, userId, env);
}

export async function updateTask(id, userId, title, priority, dueDate, env = null) {
  await query(
    'UPDATE tasks SET title = ?, priority = ?, due_date = ? WHERE id = ? AND user_id = ?',
    [title, priority, dueDate || null, id, userId],
    env
  );
  return await getTaskById(id, userId, env);
}

export async function toggleTask(id, userId, completed, env = null) {
  await query(
    'UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?',
    [Boolean(completed), id, userId],
    env
  );
  return await getTaskById(id, userId, env);
}

export async function deleteTask(id, userId, env = null) {
  await query(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?',
    [id, userId],
    env
  );
  return { success: true };
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
  deleteTask
};
