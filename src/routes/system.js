import express from 'express'
import SystemSettings from '../models/SystemSettings.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// Get system settings (admin only)
router.get('/settings', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.userId)

    if (!user || !user.is_admin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      })
    }

    const settings = await SystemSettings.getAll()

    res.json({
      settings
    })
  } catch (error) {
    console.error('Get system settings error:', error)
    res.status(500).json({
      error: 'Failed to get system settings',
      message: 'Internal server error'
    })
  }
})

// Update a system setting (admin only)
router.put('/settings/:key', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.userId)

    if (!user || !user.is_admin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      })
    }

    const { key } = req.params
    const { value } = req.body

    if (value === undefined) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Value is required'
      })
    }

    // Only allow certain settings to be modified
    const allowedSettings = ['signup_disabled']
    if (!allowedSettings.includes(key)) {
      return res.status(400).json({
        error: 'Invalid setting',
        message: 'This setting cannot be modified'
      })
    }

    await SystemSettings.set(key, value, req.userId)

    res.json({
      message: 'Setting updated successfully',
      key,
      value
    })
  } catch (error) {
    console.error('Update system setting error:', error)
    res.status(500).json({
      error: 'Failed to update system setting',
      message: 'Internal server error'
    })
  }
})

// Check signup availability (public route - doesn't require auth)
router.get('/signup-status', async (req, res) => {
  try {
    const isDisabled = await SystemSettings.isSignupDisabled()

    res.json({
      signupDisabled: isDisabled
    })
  } catch (error) {
    console.error('Check signup status error:', error)
    res.status(500).json({
      error: 'Failed to check signup status',
      message: 'Internal server error'
    })
  }
})

export default router