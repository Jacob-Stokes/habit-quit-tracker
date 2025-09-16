// Add admin field to users and create system settings table
export async function up(db) {
  // Add is_admin column to users table
  try {
    await db.run('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0')
    console.log('✅ Added is_admin column to users table')
  } catch (err) {
    // Column might already exist
    console.log('ℹ️ is_admin column may already exist:', err.message)
  }

  // Create system_settings table for global settings
  await db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,
      FOREIGN KEY (updated_by) REFERENCES users (id)
    )
  `)
  console.log('✅ Created system_settings table')

  // Insert default setting for signup_disabled
  await db.run(`
    INSERT OR IGNORE INTO system_settings (key, value)
    VALUES ('signup_disabled', 'false')
  `)
  console.log('✅ Added default signup_disabled setting')

  // Create index on system_settings
  await db.run('CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key)')
}

export async function down(db) {
  // Note: We don't remove the is_admin column as it might cause data loss
  await db.run('DROP TABLE IF EXISTS system_settings')
}