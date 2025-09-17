import express from 'express'
import Event from '../models/Event.js'
import Activity from '../models/Activity.js'
import { requireAuth } from '../middleware/auth.js'

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

    // If this is a habit and multi-entry is disabled, prevent multiple events per day
    if (activity.type === 'habit' && !activity.allow_multiple_entries_per_day) {
      const ts = timestamp ? new Date(timestamp) : new Date()
      if (Number.isNaN(ts.getTime())) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid timestamp format'
        })
      }
      const dateString = ts.toISOString().split('T')[0]
      const existingCount = await Event.countByActivityIdAndDate(activity_id, dateString)
      if (existingCount > 0) {
        const existingEvents = await Event.findByActivityIdAndDate(activity_id, dateString)
        const latestEvent = existingEvents[0]
        return res.status(200).json({
          message: 'Already logged for this day',
          event: latestEvent ? latestEvent.toJSON() : null,
          activity: activity.toJSON(),
          date: dateString,
          day_count: existingCount
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

    const now = new Date()
    const todayString = now.toISOString().split('T')[0]

    let existingTodayCount = 0
    if (activity.type === 'habit' && !activity.allow_multiple_entries_per_day) {
      existingTodayCount = await Event.countByActivityIdAndDate(activity_id, todayString)
      if (existingTodayCount > 0) {
        const existingEvents = await Event.findByActivityIdAndDate(activity_id, todayString)
        const latestEvent = existingEvents[0]

        return res.status(200).json({
          message: 'Already logged for today',
          event: latestEvent ? latestEvent.toJSON() : null,
          activity: activity.toJSON(),
          date: todayString,
          day_count: existingTodayCount
        })
      }
    }

    // Create event with current timestamp
    const event = await Event.create(activity_id)

    const eventDate = event.timestamp
      ? new Date(event.timestamp)
      : new Date()
    const eventDateString = eventDate.toISOString().split('T')[0]
    const dayCount = await Event.countByActivityIdAndDate(activity_id, eventDateString)

    res.status(201).json({
      message: 'Event logged successfully',
      event: event.toJSON(),
      activity: activity.toJSON(),
      date: eventDateString,
      day_count: dayCount
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

// Toggle completion for a specific day within the current week
router.post('/activity/:activityId/day-status', async (req, res) => {
  try {
    const { activityId } = req.params
    const { date, completed, delta } = req.body

    if (!date) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'date is required'
      })
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(date)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'date must be in YYYY-MM-DD format'
      })
    }

    const activity = await Activity.findByIdAndUser(activityId, req.userId)
    if (!activity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'Activity not found or you do not have permission to access it'
      })
    }

    if (activity.type !== 'habit') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Weekly day updates are only available for habits'
      })
    }

    const isMulti = activity.allow_multiple_entries_per_day

    if (delta !== undefined && delta !== null) {
      if (!isMulti) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Cannot adjust daily count for single-entry habits'
        })
      }

      const deltaInt = parseInt(delta, 10)
      if (Number.isNaN(deltaInt) || deltaInt === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'delta must be a non-zero integer'
        })
      }

      if (deltaInt > 0) {
        for (let i = 0; i < deltaInt; i++) {
          const timestamp = new Date(`${date}T12:00:00`)
          if (Number.isNaN(timestamp.getTime())) {
            return res.status(400).json({
              error: 'Validation failed',
              message: 'Invalid date provided'
            })
          }
          timestamp.setMinutes(timestamp.getMinutes() + i)
          await Event.create(activityId, {
            timestamp: timestamp.toISOString()
          })
        }
      } else {
        const existingEvents = await Event.findByActivityIdAndDate(activityId, date)
        if (existingEvents.length === 0) {
          // Nothing to remove
        } else {
          const removeCount = Math.min(existingEvents.length, Math.abs(deltaInt))
          const idsToDelete = existingEvents.slice(0, removeCount).map(event => event.id)
          await Event.deleteByIds(idsToDelete)
        }
      }
    } else {
      if (typeof completed !== 'boolean') {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'completed flag is required when delta is not provided'
        })
      }

      if (completed) {
        const existingEvents = await Event.findByActivityIdAndDate(activityId, date)
        if (existingEvents.length === 0) {
          const timestamp = new Date(`${date}T12:00:00`)
          if (Number.isNaN(timestamp.getTime())) {
            return res.status(400).json({
              error: 'Validation failed',
              message: 'Invalid date provided'
            })
          }

          await Event.create(activityId, {
            timestamp: timestamp.toISOString()
          })
        }
      } else {
        await Event.deleteByActivityIdAndDate(activityId, date)
      }
    }

    const count = await Event.countByActivityIdAndDate(activityId, date)
    const statistics = await activity.getStatistics()

    res.json({
      message: count > 0 ? 'Day marked as complete' : 'Day marked as incomplete',
      activity_id: activityId,
      date,
      completed: count > 0,
      count,
      statistics
    })
  } catch (error) {
    console.error('Set day status error:', error)
    res.status(500).json({
      error: 'Failed to update day status',
      message: 'Internal server error'
    })
  }
})

export default router
