const express = require('express')
const Activity = require('../models/Activity')
const database = require('../config/database')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// All routes require authentication
router.use(requireAuth)

// Get all activities for the current user
router.get('/', async (req, res) => {
  try {
    const includeStats = req.query.include_stats === 'true'
    const includeLastEvent = req.query.include_last_event === 'true'

    let activities

    if (includeLastEvent) {
      activities = await Activity.findByUserIdWithLastEvent(req.userId)
    } else {
      activities = await Activity.findByUserId(req.userId)
    }

    // Add statistics if requested
    if (includeStats) {
      for (const activity of activities) {
        activity.statistics = await activity.getStatistics()
      }
    }

    res.json({
      activities: activities
    })
  } catch (error) {
    console.error('Get activities error:', error)
    res.status(500).json({
      error: 'Failed to get activities',
      message: 'Internal server error'
    })
  }
})

// Get a specific activity
router.get('/:id', async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUser(req.params.id, req.userId)
    
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    // Include statistics by default for single activity requests
    const statistics = await activity.getStatistics()

    res.json({
      activity: {
        ...activity.toJSON(),
        statistics
      }
    })
  } catch (error) {
    console.error('Get activity error:', error)
    res.status(500).json({
      error: 'Failed to get activity',
      message: 'Internal server error'
    })
  }
})

// Create a new activity
router.post('/', async (req, res) => {
  try {
    const { name, type, color, icon } = req.body

    // Validation
    if (!name || !type) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name and type are required'
      })
    }

    if (!['habit', 'quit'].includes(type)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Type must be either "habit" or "quit"'
      })
    }

    if (name.length < 1 || name.length > 100) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name must be between 1 and 100 characters'
      })
    }

    const activity = await Activity.create(req.userId, {
      name,
      type,
      color,
      icon
    })

    res.status(201).json({
      message: 'Activity created successfully',
      activity: activity.toJSON()
    })
  } catch (error) {
    console.error('Create activity error:', error)
    
    if (error.message.includes('must be either')) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Failed to create activity',
      message: 'Internal server error'
    })
  }
})

// Update an activity
router.put('/:id', async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUser(req.params.id, req.userId)
    
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    const { name, type, color, icon } = req.body

    // Validation
    if (name !== undefined && (name.length < 1 || name.length > 100)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name must be between 1 and 100 characters'
      })
    }

    if (type !== undefined && !['habit', 'quit'].includes(type)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Type must be either "habit" or "quit"'
      })
    }

    const updatedActivity = await activity.update({
      name,
      type,
      color,
      icon
    })

    res.json({
      message: 'Activity updated successfully',
      activity: updatedActivity.toJSON()
    })
  } catch (error) {
    console.error('Update activity error:', error)
    
    if (error.message.includes('must be either')) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Failed to update activity',
      message: 'Internal server error'
    })
  }
})

// Archive an activity (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUser(req.params.id, req.userId)
    
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    await activity.archive()

    res.json({
      message: 'Activity archived successfully'
    })
  } catch (error) {
    console.error('Archive activity error:', error)
    res.status(500).json({
      error: 'Failed to archive activity',
      message: 'Internal server error'
    })
  }
})

// Restore an archived activity
router.post('/:id/restore', async (req, res) => {
  try {
    // Find even archived activities for restore
    const row = await database.get(
      'SELECT * FROM activities WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    )
    
    if (!row) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    const activity = new Activity(row)
    await activity.restore()

    res.json({
      message: 'Activity restored successfully',
      activity: activity.toJSON()
    })
  } catch (error) {
    console.error('Restore activity error:', error)
    res.status(500).json({
      error: 'Failed to restore activity',
      message: 'Internal server error'
    })
  }
})

// Get activity statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUser(req.params.id, req.userId)
    
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    const statistics = await activity.getStatistics()

    res.json({
      activity_id: activity.id,
      statistics
    })
  } catch (error) {
    console.error('Get activity stats error:', error)
    res.status(500).json({
      error: 'Failed to get activity statistics',
      message: 'Internal server error'
    })
  }
})

// Update activity's selected goal
router.patch('/:id/goal', async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUser(req.params.id, req.userId)
    
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    const { goal_name, goal_hours } = req.body

    // Validation
    if (!goal_name || !goal_hours) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Goal name and hours are required'
      })
    }

    const updatedActivity = await activity.update({
      selected_goal_name: goal_name,
      selected_goal_hours: goal_hours
    })

    res.json({
      message: 'Goal updated successfully',
      activity: updatedActivity.toJSON()
    })
  } catch (error) {
    console.error('Update goal error:', error)
    res.status(500).json({
      error: 'Failed to update goal',
      message: 'Internal server error'
    })
  }
})

module.exports = router