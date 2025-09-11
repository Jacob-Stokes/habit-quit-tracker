import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sqlite = sqlite3.verbose()
const dbPath = path.join(__dirname, 'habits.db')

// Ensure database directory exists
if (!fs.existsSync(__dirname)) {
  fs.mkdirSync(__dirname, { recursive: true })
}

const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message)
    process.exit(1)
  }
  console.log('Connected to SQLite database')
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message)
      } else {
        console.log('Users table created successfully')
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating activities table:', err.message)
      } else {
        console.log('Activities table created successfully')
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
        console.error('Error creating events table:', err.message)
      } else {
        console.log('Events table created successfully')
      }
    })

    // Create indexes for better performance
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_events_activity 
      ON events(activity_id, timestamp DESC)
    `, (err) => {
      if (err) {
        console.error('Error creating events index:', err.message)
      } else {
        console.log('Events index created successfully')
      }
    })

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_activities_user 
      ON activities(user_id)
    `, (err) => {
      if (err) {
        console.error('Error creating activities index:', err.message)
      } else {
        console.log('Activities index created successfully')
      }
    })
  })
}

// Run the setup
createTables()

// Close database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message)
  } else {
    console.log('Database setup completed successfully')
  }
})