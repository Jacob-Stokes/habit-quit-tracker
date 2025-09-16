import express from 'express'
import session from 'express-session'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
// import FileStore from 'session-file-store'

dotenv.config()

import database from './config/database.js'
import { runMigrations } from '../database/migrations/migration-system.js'

// Import routes
import authRoutes from './routes/auth.js'
import activityRoutes from './routes/activities.js'
import eventRoutes from './routes/events.js'
import apiKeyRoutes from './routes/apikeys.js'
import themeRoutes from './routes/themes.js'
import systemRoutes from './routes/system.js'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

// Logging
app.use(morgan('combined'))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Trust proxy (nginx terminates HTTPS)
app.set('trust proxy', 1)

// Session configuration (temporarily using memory store)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // nginx handles HTTPS, container receives HTTP
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Serve static files
app.use(express.static(path.join(__dirname, '../public')))

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/activities', activityRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/apikeys', apiKeyRoutes)
app.use('/api/themes', themeRoutes)
app.use('/api/system', systemRoutes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// Serve frontend for all other routes (SPA support)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack)
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack })
  })
})

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' })
})

// Initialize database and start server
const startServer = async () => {
  try {
    await database.connect()

    // Run migrations to ensure database is up to date
    const dbPath = path.join(__dirname, '..', 'database', 'habits.db')
    console.log('📦 Checking database migrations...')
    await runMigrations(dbPath)

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
      console.log(`🌐 Network access: http://192.168.0.231:${PORT}`)
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  database.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...')
  database.close()
  process.exit(0)
})

startServer()

export default app