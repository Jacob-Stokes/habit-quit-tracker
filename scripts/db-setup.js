import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sqlite = sqlite3.verbose()
const dbPath = path.join(__dirname, '../database/habits.db')

console.log('🔧 Initializing database...')

const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message)
    process.exit(1)
  }
  console.log('✅ Connected to SQLite database')
})

// Create tables with proper sequencing
const createTables = () => {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        default_abstinence_text TEXT DEFAULT 'Abstinence time',
        show_habits_tab BOOLEAN DEFAULT 1,
        show_quits_tab BOOLEAN DEFAULT 1,
        show_logs_tab BOOLEAN DEFAULT 1,
        custom_title TEXT DEFAULT 'Habit Tracker',
        show_title_section BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating users table:', err.message)
      } else {
        console.log('✅ Users table ready')
      }
    })

    // Activities table (both habits and quits)
    db.run(`
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
        selected_goal_hours INTEGER,
        abstinence_text TEXT,
        use_default_abstinence_text BOOLEAN DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating activities table:', err.message)
      } else {
        console.log('✅ Activities table ready')
      }
    })

    // Events table (when something happened)
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating events table:', err.message)
      } else {
        console.log('✅ Events table ready')
      }
    })

    // API Keys table
    db.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating api_keys table:', err.message)
      } else {
        console.log('✅ API Keys table ready')
      }
    })

    // Sessions table for persistent session storage
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating sessions table:', err.message)
      } else {
        console.log('✅ Sessions table ready')
      }
    })

    // System defaults table (unchangeable defaults set by developer)
    db.run(`
      CREATE TABLE IF NOT EXISTS system_defaults (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating system_defaults table:', err.message)
      } else {
        console.log('✅ System defaults table ready')

        // Insert default values
        db.run(`
          INSERT OR IGNORE INTO system_defaults (key, value, description)
          VALUES
            ('default_abstinence_text', 'Abstinence time', 'Default text shown for quit activities'),
            ('default_title', 'Habit Tracker', 'Default application title')
        `, (err) => {
          if (err) {
            console.error('❌ Error inserting system defaults:', err.message)
          } else {
            console.log('✅ System defaults initialized')
          }
        })
      }
    })

    // Create indexes for better performance
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_events_activity 
      ON events(activity_id, timestamp DESC)
    `, (err) => {
      if (err) {
        console.error('❌ Error creating events index:', err.message)
      } else {
        console.log('✅ Events index ready')
      }
    })

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_activities_user 
      ON activities(user_id)
    `, (err) => {
      if (err) {
        console.error('❌ Error creating activities index:', err.message)
      } else {
        console.log('✅ Activities index ready')
      }
    })

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expire
      ON sessions(expire)
    `, (err) => {
      if (err) {
        console.error('❌ Error creating sessions index:', err.message)
      } else {
        console.log('✅ Sessions index ready')
      }
    })
  })
}

// Run the setup
createTables()

// Close database connection
db.close((err) => {
  if (err) {
    console.error('❌ Error closing database:', err.message)
    process.exit(1)
  } else {
    console.log('🎉 Database initialization completed!')
  }
})