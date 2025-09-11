const express = require('express')
const Event = require('../models/Event')
const Activity = require('../models/Activity')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// All routes require authentication
router.use(requireAuth)

// Get all events for the current user
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || null
    const offset = parseInt(req.query.offset) || 0
    const activityId = req.query.activity_id
    const includeActivity = req.query.include_activity === 'true'
    const today = req.query.today === 'true'

    let events

    if (today) {
      events = await Event.findTodayByUserId(req.userId)
    } else if (activityId) {
      // Verify user owns the activity
      const activity = await Activity.findByIdAndUser(activityId, req.userId)
      if (!activity) {
        return res.status(404).json({
          error: 'Activity not found',
          message: 'Activity not found or you do not have permission to access it'
        })
      }
      events = await Event.findByActivityId(activityId, limit, offset)
    } else if (includeActivity) {
      events = await Event.findByUserIdWithActivity(req.userId, limit, offset)
    } else {
      events = await Event.findByUserId(req.userId, limit, offset)
    }

    res.json({
      events: events,
      pagination: limit ? {
        limit,
        offset,
        hasMore: events.length === limit
      } : null
    })
  } catch (error) {
    console.error('Get events error:', error)
    res.status(500).json({
      error: 'Failed to get events',
      message: 'Internal server error'
    })
  }
})

// Get a specific event
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUser(req.params.id, req.userId)
    
    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
        message: 'Event not found or you do not have permission to access it'
      })
    }

    res.json({
      event: event.toJSON()
    })
  } catch (error) {
    console.error('Get event error:', error)
    res.status(500).json({
      error: 'Failed to get event',
      message: 'Internal server error'
    })
  }
})

// Create a new event (log an activity)
router.post('/', async (req, res) => {
  try {
    const { activity_id, timestamp, note } = req.body

    // Validation
    if (!activity_id) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Activity ID is required'
      })
    }

    // Verify user owns the activity
    const activity = await Activity.findByIdAndUser(activity_id, req.userId)
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    // Validate timestamp if provided
    if (timestamp) {
      const parsedDate = new Date(timestamp)
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid timestamp format'
        })
      }
    }

    const event = await Event.create(activity_id, {
      timestamp,
      note
    })

    res.status(201).json({
      message: 'Event logged successfully',
      event: event.toJSON()
    })
  } catch (error) {
    console.error('Create event error:', error)
    res.status(500).json({
      error: 'Failed to log event',
      message: 'Internal server error'
    })
  }
})

// Update an event
router.put('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUser(req.params.id, req.userId)
    
    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
        message: 'Event not found or you do not have permission to access it'
      })
    }

    const { timestamp, note } = req.body

    // Validate timestamp if provided
    if (timestamp) {
      const parsedDate = new Date(timestamp)
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid timestamp format'
        })
      }
    }

    const updatedEvent = await event.update({
      timestamp,
      note
    })

    res.json({
      message: 'Event updated successfully',
      event: updatedEvent.toJSON()
    })
  } catch (error) {
    console.error('Update event error:', error)
    res.status(500).json({
      error: 'Failed to update event',
      message: 'Internal server error'
    })
  }
})

// Delete an event
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUser(req.params.id, req.userId)
    
    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
        message: 'Event not found or you do not have permission to access it'
      })
    }

    await event.delete()

    res.json({
      message: 'Event deleted successfully'
    })
  } catch (error) {
    console.error('Delete event error:', error)
    res.status(500).json({
      error: 'Failed to delete event',
      message: 'Internal server error'
    })
  }
})

// Quick log endpoint (simplified event creation)
router.post('/quick-log', async (req, res) => {
  try {
    const { activity_id } = req.body

    // Validation
    if (!activity_id) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Activity ID is required'
      })
    }

    // Verify user owns the activity
    const activity = await Activity.findByIdAndUser(activity_id, req.userId)
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    // Create event with current timestamp
    const event = await Event.create(activity_id)

    res.status(201).json({
      message: 'Event logged successfully',
      event: event.toJSON(),
      activity: activity.toJSON()
    })
  } catch (error) {
    console.error('Quick log error:', error)
    res.status(500).json({
      error: 'Failed to log event',
      message: 'Internal server error'
    })
  }
})

// Get events for a specific activity within a date range
router.get('/activity/:activityId/range', async (req, res) => {
  try {
    const { activityId } = req.params
    const { start_date, end_date } = req.query

    // Verify user owns the activity
    const activity = await Activity.findByIdAndUser(activityId, req.userId)
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    // Validate dates
    if (!start_date || !end_date) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'start_date and end_date are required'
      })
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid date format'
      })
    }

    const events = await Event.findByActivityIdAndDateRange(
      activityId,
      startDate.toISOString(),
      endDate.toISOString()
    )

    res.json({
      activity_id: activityId,
      start_date: start_date,
      end_date: end_date,
      events: events
    })
  } catch (error) {
    console.error('Get events by date range error:', error)
    res.status(500).json({
      error: 'Failed to get events',
      message: 'Internal server error'
    })
  }
})

module.exports = router