import express from 'express'
import Theme from '../models/Theme.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(requireAuth)

// Get all themes (built-in + user's custom themes)
router.get('/', async (req, res) => {
  try {
    // Get built-in themes
    const builtInThemes = Theme.getBuiltInThemes()

    // Get user's custom themes
    const customThemes = await Theme.findByUserId(req.userId)

    res.json({
      builtIn: builtInThemes,
      custom: customThemes.map(theme => theme.toJSON())
    })
  } catch (error) {
    console.error('Get themes error:', error)
    res.status(500).json({
      error: 'Failed to get themes',
      message: 'Internal server error'
    })
  }
})

// Create a new custom theme
router.post('/', async (req, res) => {
  try {
    const { name, colors } = req.body

    if (!name || !colors) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name and colors are required'
      })
    }

    const theme = await Theme.create(req.userId, {
      name,
      colors
    })

    res.status(201).json({
      message: 'Theme created successfully',
      theme: theme.toJSON()
    })
  } catch (error) {
    console.error('Create theme error:', error)
    res.status(500).json({
      error: 'Failed to create theme',
      message: 'Internal server error'
    })
  }
})

// Update a custom theme
router.put('/:id', async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id)

    if (!theme) {
      return res.status(404).json({
        error: 'Theme not found',
        message: 'Theme not found'
      })
    }

    // Check ownership
    if (theme.user_id !== req.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only edit your own themes'
      })
    }

    const { name, colors } = req.body
    const updatedTheme = await theme.update({ name, colors })

    res.json({
      message: 'Theme updated successfully',
      theme: updatedTheme.toJSON()
    })
  } catch (error) {
    console.error('Update theme error:', error)
    res.status(500).json({
      error: 'Failed to update theme',
      message: 'Internal server error'
    })
  }
})

// Delete a custom theme
router.delete('/:id', async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id)

    if (!theme) {
      return res.status(404).json({
        error: 'Theme not found',
        message: 'Theme not found'
      })
    }

    // Check ownership
    if (theme.user_id !== req.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own themes'
      })
    }

    await theme.delete()

    res.json({
      message: 'Theme deleted successfully'
    })
  } catch (error) {
    console.error('Delete theme error:', error)
    res.status(500).json({
      error: 'Failed to delete theme',
      message: 'Internal server error'
    })
  }
})

// Apply a theme
router.post('/apply', async (req, res) => {
  try {
    const { themeName } = req.body

    if (!themeName) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Theme name is required'
      })
    }

    await User.updatePreferences(req.userId, {
      selectedTheme: themeName
    })

    res.json({
      message: 'Theme applied successfully',
      theme: themeName
    })
  } catch (error) {
    console.error('Apply theme error:', error)
    res.status(500).json({
      error: 'Failed to apply theme',
      message: 'Internal server error'
    })
  }
})

export default router