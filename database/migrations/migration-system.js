import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class MigrationRunner {
  constructor(dbPath) {
    this.dbPath = dbPath
    this.db = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => resolve())
      } else {
        resolve()
      }
    })
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err)
        else resolve({ lastID: this.lastID, changes: this.changes })
      })
    })
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  async setupMigrationsTable() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  async getCurrentVersion() {
    const row = await this.get('SELECT MAX(version) as version FROM migrations')
    return row?.version || 0
  }

  async recordMigration(version, name) {
    await this.run('INSERT INTO migrations (version, name) VALUES (?, ?)', [version, name])
  }

  async runMigrations() {
    try {
      await this.connect()
      await this.setupMigrationsTable()

      const currentVersion = await this.getCurrentVersion()
      console.log(`📊 Current database version: ${currentVersion}`)

      // Load all migration files
      const migrationsDir = __dirname
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.match(/^\d{3}-.*\.js$/))
        .sort()

      let appliedCount = 0

      for (const file of files) {
        const version = parseInt(file.substring(0, 3))

        if (version > currentVersion) {
          console.log(`\n📦 Applying migration ${version}: ${file}`)

          const migrationPath = path.join(migrationsDir, file)
          const migration = await import(migrationPath)

          if (migration.up) {
            await migration.up(this)
            await this.recordMigration(version, file)
            console.log(`✅ Applied: ${file}`)
            appliedCount++
          } else {
            console.log(`⚠️  Skipped ${file}: No 'up' function found`)
          }
        }
      }

      if (appliedCount === 0) {
        console.log('✨ Database is already up to date!')
      } else {
        console.log(`\n🎉 Successfully applied ${appliedCount} migration(s)`)
      }

      const newVersion = await this.getCurrentVersion()
      console.log(`📊 New database version: ${newVersion}`)

    } catch (error) {
      console.error('❌ Migration failed:', error.message)
      throw error
    } finally {
      await this.close()
    }
  }
}

// Export a function to run migrations
export async function runMigrations(dbPath) {
  const runner = new MigrationRunner(dbPath)
  await runner.runMigrations()
}