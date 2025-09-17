export async function up(db) {
  await db.run(`
    ALTER TABLE activities
    ADD COLUMN allow_multiple_entries_per_day BOOLEAN DEFAULT 0
  `)
}

export async function down(db) {
  // SQLite does not support dropping columns directly; recreate table without the column
  await db.run('ALTER TABLE activities RENAME TO activities_backup')

  await db.run(`
    CREATE TABLE activities (
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

  await db.run(`
    INSERT INTO activities (
      id, user_id, name, type, color, icon, created_at, archived,
      selected_goal_name, selected_goal_hours, abstinence_text,
      use_default_abstinence_text, display_order
    )
    SELECT
      id, user_id, name, type, color, icon, created_at, archived,
      selected_goal_name, selected_goal_hours, abstinence_text,
      use_default_abstinence_text, display_order
    FROM activities_backup
  `)

  await db.run('DROP TABLE activities_backup')

  await db.run('CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)')
}
