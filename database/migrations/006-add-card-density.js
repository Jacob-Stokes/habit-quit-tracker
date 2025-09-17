export async function up(db) {
  await db.run(`
    ALTER TABLE users
    ADD COLUMN card_density TEXT DEFAULT 'comfy'
  `)
}

export async function down(db) {
  await db.run('ALTER TABLE users RENAME TO users_backup')

  await db.run(`
    CREATE TABLE users (
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
      is_admin BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.run(`
    INSERT INTO users (
      id, username, password_hash, default_abstinence_text,
      show_habits_tab, show_quits_tab, show_logs_tab, custom_title,
      show_title_section, selected_theme, is_admin, created_at
    )
    SELECT
      id, username, password_hash, default_abstinence_text,
      show_habits_tab, show_quits_tab, show_logs_tab, custom_title,
      show_title_section, selected_theme, is_admin, created_at
    FROM users_backup
  `)

  await db.run('DROP TABLE users_backup')
}
