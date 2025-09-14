// Initial database schema
export async function up(db) {
  // Create users table
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      default_abstinence_text TEXT DEFAULT 'Abstinence time',
      show_habits_tab BOOLEAN DEFAULT 1,
      show_quits_tab BOOLEAN DEFAULT 1,
      show_logs_tab BOOLEAN DEFAULT 1,
      custom_title TEXT DEFAULT 'Habit Tracker',
      show_title_section BOOLEAN DEFAULT 1,
      selected_theme TEXT DEFAULT 'light',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create activities table
  await db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('habit', 'quit')),
      color TEXT DEFAULT '#6366f1',
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      archived BOOLEAN DEFAULT 0,
      selected_goal_name TEXT,
      selected_goal_hours REAL,
      abstinence_text TEXT,
      use_default_abstinence_text BOOLEAN DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `)

  // Create events table
  await db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_retroactive BOOLEAN DEFAULT 0,
      note TEXT,
      FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE
    )
  `)

  // Create api_keys table
  await db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      last_used DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `)

  // Create sessions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired DATETIME NOT NULL
    )
  `)

  // Create indexes
  await db.run('CREATE INDEX IF NOT EXISTS idx_events_activity_id ON events(activity_id)')
  await db.run('CREATE INDEX IF NOT EXISTS idx_events_logged_at ON events(logged_at)')
  await db.run('CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)')
  await db.run('CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)')

  console.log('  ✓ Created core tables and indexes')
}

export async function down(db) {
  // Drop all tables in reverse order
  await db.run('DROP TABLE IF EXISTS events')
  await db.run('DROP TABLE IF EXISTS activities')
  await db.run('DROP TABLE IF EXISTS api_keys')
  await db.run('DROP TABLE IF EXISTS sessions')
  await db.run('DROP TABLE IF EXISTS users')
}