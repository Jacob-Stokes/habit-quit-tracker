import express from 'express'
import User from '../models/User.js'
import SystemSettings from '../models/SystemSettings.js'
import database from '../config/database.js'
import { requireAuth, requireGuest } from '../middleware/auth.js'

const router = express.Router()

// Register new user
router.post('/register', requireGuest, async (req, res) => {
  try {
    // Check if signup is disabled
    const signupDisabled = await SystemSettings.isSignupDisabled()
    if (signupDisabled) {
      return res.status(403).json({
        error: 'Registration disabled',
        message: 'New user registration is currently disabled'
      })
    }

    const { username, password } = req.body

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Username and password are required'
      })
    }

    if (username.length < 3) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Username must be at least 3 characters long'
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Password must be at least 6 characters long'
      })
    }

    // Create user
    const user = await User.create(username, password)

    // Create session
    req.session.userId = user.id

    res.status(201).json({
      message: 'User created successfully',
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Registration error:', error)
    
    if (error.message === 'Username already exists') {
      return res.status(409).json({
        error: 'Username taken',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error'
    })
  }
})

// Login user
router.post('/login', requireGuest, async (req, res) => {
  try {
    const { username, password } = req.body

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Username and password are required'
      })
    }

    // Find user
    const user = await User.findByUsername(username)
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid username or password'
      })
    }

    // Verify password
    const isValidPassword = await user.verifyPassword(password)
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid username or password'
      })
    }

    // Create session
    req.session.userId = user.id

    res.json({
      message: 'Login successful',
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error'
    })
  }
})

// Logout user
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
      return res.status(500).json({
        error: 'Logout failed',
        message: 'Internal server error'
      })
    }

    res.clearCookie('connect.sid') // Clear session cookie
    res.json({
      message: 'Logout successful'
    })
  })
})

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account not found'
      })
    }

    res.json({
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({
      error: 'Failed to get user',
      message: 'Internal server error'
    })
  }
})

// Update user preferences
router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const { defaultAbstinenceText, showHabitsTab, showQuitsTab, showLogsTab, customTitle, showTitleSection } = req.body

    // Validate that at least one main tab (habits or quits) is visible
    if (showHabitsTab === false && showQuitsTab === false) {
      return res.status(400).json({
        error: 'Invalid configuration',
        message: 'At least one of Habits or Quits tabs must be visible'
      })
    }

    await User.updatePreferences(req.userId, {
      defaultAbstinenceText,
      showHabitsTab,
      showQuitsTab,
      showLogsTab,
      customTitle,
      showTitleSection
    })

    res.json({
      message: 'Preferences updated successfully'
    })
  } catch (error) {
    console.error('Update preferences error:', error)
    res.status(500).json({
      error: 'Failed to update preferences',
      message: 'Internal server error'
    })
  }
})

// Check authentication status
router.get('/status', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.userId),
    userId: req.session?.userId || null
  })
})

// Restore default preferences from system defaults
router.post('/preferences/restore-defaults', requireAuth, async (req, res) => {
  try {
    // Get system defaults from database
    const abstinenceDefault = await database.get(
      'SELECT value FROM system_defaults WHERE key = ?',
      ['default_abstinence_text']
    )

    const titleDefault = await database.get(
      'SELECT value FROM system_defaults WHERE key = ?',
      ['default_title']
    )

    const defaultAbstinence = abstinenceDefault?.value || 'Abstinence time'
    const defaultTitle = titleDefault?.value || 'Habit Tracker'

    await User.updatePreferences(req.userId, {
      defaultAbstinenceText: defaultAbstinence,
      customTitle: defaultTitle
    })

    res.json({
      message: 'Defaults restored successfully',
      preferences: {
        default_abstinence_text: defaultAbstinence,
        custom_title: defaultTitle
      }
    })
  } catch (error) {
    console.error('Restore defaults error:', error)
    res.status(500).json({
      error: 'Failed to restore defaults',
      message: 'Internal server error'
    })
  }
})

export default router