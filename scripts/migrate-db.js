import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'habits.db')

console.log('Running database migrations...')
console.log('Database path:', dbPath)

const db = new sqlite3.Database(dbPath)

// Function to check if a column exists
function columnExists(tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err)
      } else {
        const exists = rows.some(row => row.name === columnName)
        resolve(exists)
      }
    })
  })
}

// Function to run a migration
function runMigration(sql, description) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`❌ Failed: ${description}`)
        console.error(err.message)
        reject(err)
      } else {
        console.log(`✅ Success: ${description}`)
        resolve()
      }
    })
  })
}

async function applyMigrations() {
  try {
    // Check and add show_habits_tab column
    if (!(await columnExists('users', 'show_habits_tab'))) {
      await runMigration(
        'ALTER TABLE users ADD COLUMN show_habits_tab BOOLEAN DEFAULT 1',
        'Added show_habits_tab column'
      )
    } else {
      console.log('⏭️  Skipped: show_habits_tab column already exists')
    }

    // Check and add show_quits_tab column
    if (!(await columnExists('users', 'show_quits_tab'))) {
      await runMigration(
        'ALTER TABLE users ADD COLUMN show_quits_tab BOOLEAN DEFAULT 1',
        'Added show_quits_tab column'
      )
    } else {
      console.log('⏭️  Skipped: show_quits_tab column already exists')
    }

    // Check and add show_logs_tab column
    if (!(await columnExists('users', 'show_logs_tab'))) {
      await runMigration(
        'ALTER TABLE users ADD COLUMN show_logs_tab BOOLEAN DEFAULT 1',
        'Added show_logs_tab column'
      )
    } else {
      console.log('⏭️  Skipped: show_logs_tab column already exists')
    }

    // Check and add custom_title column
    if (!(await columnExists('users', 'custom_title'))) {
      await runMigration(
        "ALTER TABLE users ADD COLUMN custom_title TEXT DEFAULT 'Habit Tracker'",
        'Added custom_title column'
      )
    } else {
      console.log('⏭️  Skipped: custom_title column already exists')
    }

    // Check and add show_title_section column
    if (!(await columnExists('users', 'show_title_section'))) {
      await runMigration(
        'ALTER TABLE users ADD COLUMN show_title_section BOOLEAN DEFAULT 1',
        'Added show_title_section column'
      )
    } else {
      console.log('⏭️  Skipped: show_title_section column already exists')
    }

    // Check and add selected_theme column
    if (!(await columnExists('users', 'selected_theme'))) {
      await runMigration(
        "ALTER TABLE users ADD COLUMN selected_theme TEXT DEFAULT 'light'",
        'Added selected_theme column'
      )
    } else {
      console.log('⏭️  Skipped: selected_theme column already exists')
    }

    // Check and add default_abstinence_text column
    if (!(await columnExists('users', 'default_abstinence_text'))) {
      await runMigration(
        "ALTER TABLE users ADD COLUMN default_abstinence_text TEXT DEFAULT 'Abstinence time'",
        'Added default_abstinence_text column'
      )
    } else {
      console.log('⏭️  Skipped: default_abstinence_text column already exists')
    }

    // Check and add columns to activities table
    if (!(await columnExists('activities', 'abstinence_text'))) {
      await runMigration(
        'ALTER TABLE activities ADD COLUMN abstinence_text TEXT',
        'Added abstinence_text column to activities'
      )
    } else {
      console.log('⏭️  Skipped: abstinence_text column already exists in activities')
    }

    if (!(await columnExists('activities', 'use_default_abstinence_text'))) {
      await runMigration(
        'ALTER TABLE activities ADD COLUMN use_default_abstinence_text BOOLEAN DEFAULT 1',
        'Added use_default_abstinence_text column to activities'
      )
    } else {
      console.log('⏭️  Skipped: use_default_abstinence_text column already exists in activities')
    }

    // Create themes table if it doesn't exist
    await runMigration(
      `CREATE TABLE IF NOT EXISTS themes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        colors TEXT NOT NULL,
        is_built_in BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      )`,
      'Created themes table'
    )

    // Create system_defaults table if it doesn't exist
    await runMigration(
      `CREATE TABLE IF NOT EXISTS system_defaults (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      'Created system_defaults table'
    )

    // Insert default system values if they don't exist
    await runMigration(
      `INSERT OR IGNORE INTO system_defaults (key, value, description) VALUES
        ('default_abstinence_text', 'Abstinence time', 'Default text shown for quit activities'),
        ('default_title', 'Habit Tracker', 'Default application title')`,
      'Inserted system defaults'
    )

    console.log('\n✨ All migrations completed successfully!')
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    db.close()
  }
}

// Run migrations
applyMigrations()