#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from '../database/migrations/migration-system.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'habits.db')

console.log('🚀 Starting database migrations...')
console.log('📁 Database path:', dbPath)
console.log('─'.repeat(50))

runMigrations(dbPath)
  .then(() => {
    console.log('─'.repeat(50))
    console.log('✅ Migration complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('─'.repeat(50))
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })