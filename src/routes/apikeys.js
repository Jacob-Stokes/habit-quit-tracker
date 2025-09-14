import express from 'express'
import ApiKey from '../models/ApiKey.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(requireAuth)

// Get all API keys for current user
router.get('/', async (req, res) => {
  try {
    const keys = await ApiKey.findByUserId(req.userId)
    res.json({ keys })
  } catch (error) {
    console.error('Get API keys error:', error)
    res.status(500).json({ error: 'Failed to get API keys' })
  }
})

// Create new API key
router.post('/', async (req, res) => {
  try {
    const { name } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const apiKey = await ApiKey.create(req.userId, name.trim())

    res.status(201).json({
      message: 'API key created successfully. Save this key - it will only be shown once!',
      apiKey
    })
  } catch (error) {
    console.error('Create API key error:', error)
    res.status(500).json({ error: 'Failed to create API key' })
  }
})

// Delete API key
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ApiKey.delete(req.params.id, req.userId)

    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' })
    }

    res.json({ message: 'API key deleted successfully' })
  } catch (error) {
    console.error('Delete API key error:', error)
    res.status(500).json({ error: 'Failed to delete API key' })
  }
})

export default router