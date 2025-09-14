// Add themes and system defaults tables
export async function up(db) {
  // Create themes table
  await db.run(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      colors TEXT NOT NULL,
      is_built_in BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `)

  // Create system_defaults table
  await db.run(`
    CREATE TABLE IF NOT EXISTS system_defaults (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Insert default system values
  await db.run(`
    INSERT OR IGNORE INTO system_defaults (key, value, description) VALUES
      ('default_abstinence_text', 'Abstinence time', 'Default text shown for quit activities'),
      ('default_title', 'Habit Tracker', 'Default application title')
  `)

  console.log('  ✓ Created themes and system_defaults tables')
}