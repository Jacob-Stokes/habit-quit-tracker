import { v4 as uuidv4 } from 'uuid'
import database from '../config/database.js'

class Activity {
  constructor(data) {
    this.id = data.id
    this.user_id = data.user_id
    this.name = data.name
    this.type = data.type
    this.color = data.color
    this.icon = data.icon
    this.created_at = data.created_at
    this.archived = data.archived
    this.selected_goal_name = data.selected_goal_name
    this.selected_goal_hours = data.selected_goal_hours
    this.abstinence_text = data.abstinence_text
    this.use_default_abstinence_text = data.use_default_abstinence_text !== 0
  }

  // Create a new activity
  static async create(userId, activityData) {
    const { name, type, color = '#6366f1', icon = null, abstinenceText = null, useDefaultAbstinence = true } = activityData

    // Validation
    if (!name || !type) {
      throw new Error('Name and type are required')
    }

    if (!['habit', 'quit'].includes(type)) {
      throw new Error('Type must be either "habit" or "quit"')
    }

    const id = uuidv4()

    // Only store custom text if not using default
    const textToStore = useDefaultAbstinence ? null : abstinenceText
    const useDefault = type === 'quit' ? (useDefaultAbstinence ? 1 : 0) : 1

    await database.run(
      'INSERT INTO activities (id, user_id, name, type, color, icon, abstinence_text, use_default_abstinence_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, name, type, color, icon, textToStore, useDefault]
    )

    return await Activity.findById(id)
  }

  // Find activity by ID
  static async findById(id) {
    const row = await database.get(
      'SELECT * FROM activities WHERE id = ? AND archived = 0',
      [id]
    )
    
    return row ? new Activity(row) : null
  }

  // Find activity by ID and user (for authorization)
  static async findByIdAndUser(id, userId) {
    const row = await database.get(
      'SELECT * FROM activities WHERE id = ? AND user_id = ? AND archived = 0',
      [id, userId]
    )
    
    return row ? new Activity(row) : null
  }

  // Get all activities for a user
  static async findByUserId(userId) {
    const rows = await database.all(
      'SELECT * FROM activities WHERE user_id = ? AND archived = 0 ORDER BY created_at DESC',
      [userId]
    )
    
    return rows.map(row => new Activity(row))
  }

  // Get activities with their latest event info
  static async findByUserIdWithLastEvent(userId) {
    const rows = await database.all(`
      SELECT 
        a.*,
        e.timestamp as last_event_timestamp,
        e.note as last_event_note
      FROM activities a
      LEFT JOIN (
        SELECT 
          activity_id,
          timestamp,
          note,
          ROW_NUMBER() OVER (PARTITION BY activity_id ORDER BY timestamp DESC) as rn
        FROM events
      ) e ON a.id = e.activity_id AND e.rn = 1
      WHERE a.user_id = ? AND a.archived = 0
      ORDER BY a.created_at DESC
    `, [userId])

    return rows.map(row => {
      const activity = new Activity(row)
      activity.lastEvent = row.last_event_timestamp ? {
        timestamp: row.last_event_timestamp,
        note: row.last_event_note
      } : null
      return activity
    })
  }

  // Update activity
  async update(data) {
    const allowedFields = ['name', 'type', 'color', 'icon', 'selected_goal_name', 'selected_goal_hours']
    const updates = []
    const values = []

    // Handle abstinence text separately to manage the flag
    if (data.abstinence_text !== undefined || data.use_default_abstinence_text !== undefined) {
      if (data.use_default_abstinence_text) {
        updates.push('abstinence_text = NULL')
        updates.push('use_default_abstinence_text = 1')
      } else if (data.abstinence_text !== undefined) {
        updates.push('abstinence_text = ?')
        values.push(data.abstinence_text)
        updates.push('use_default_abstinence_text = 0')
      }
    }

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'type' && !['habit', 'quit'].includes(data[field])) {
          throw new Error('Type must be either "habit" or "quit"')
        }
        updates.push(`${field} = ?`)
        values.push(data[field])
      }
    }

    if (updates.length === 0) {
      return this
    }

    values.push(this.id)

    await database.run(
      `UPDATE activities SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return await Activity.findById(this.id)
  }

  // Archive activity (soft delete)
  async archive() {
    await database.run(
      'UPDATE activities SET archived = 1 WHERE id = ?',
      [this.id]
    )
  }

  // Restore archived activity
  async restore() {
    await database.run(
      'UPDATE activities SET archived = 0 WHERE id = ?',
      [this.id]
    )
  }

  // Get activity statistics
  async getStatistics() {
    const stats = await database.get(`
      SELECT 
        COUNT(*) as total_events,
        MIN(timestamp) as first_event,
        MAX(timestamp) as last_event
      FROM events 
      WHERE activity_id = ?
    `, [this.id])

    // Calculate current streak
    const currentStreak = await this.getCurrentStreak()
    const longestStreak = await this.getLongestStreak()

    return {
      totalEvents: stats.total_events || 0,
      firstEvent: stats.first_event,
      lastEvent: stats.last_event,
      currentStreak,
      longestStreak
    }
  }

  // Calculate current streak
  async getCurrentStreak() {
    const events = await database.all(`
      SELECT DATE(timestamp) as event_date 
      FROM events 
      WHERE activity_id = ? 
      ORDER BY timestamp DESC
    `, [this.id])

    if (events.length === 0) return 0

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    let streak = 0
    let currentDate = today

    // Check if there's an event today or yesterday to start the streak
    if (events[0].event_date !== today && events[0].event_date !== yesterday) {
      return 0
    }

    // If no event today but event yesterday, start from yesterday
    if (events[0].event_date !== today) {
      currentDate = yesterday
    }

    for (const event of events) {
      if (event.event_date === currentDate) {
        streak++
        // Move to previous day
        const prevDate = new Date(currentDate)
        prevDate.setDate(prevDate.getDate() - 1)
        currentDate = prevDate.toISOString().split('T')[0]
      } else {
        break
      }
    }

    return streak
  }

  // Calculate longest streak
  async getLongestStreak() {
    const events = await database.all(`
      SELECT DISTINCT DATE(timestamp) as event_date 
      FROM events 
      WHERE activity_id = ? 
      ORDER BY event_date ASC
    `, [this.id])

    if (events.length === 0) return 0

    let longestStreak = 1
    let currentStreak = 1

    for (let i = 1; i < events.length; i++) {
      const prevDate = new Date(events[i - 1].event_date)
      const currentDate = new Date(events[i].event_date)
      
      // Check if dates are consecutive
      const diffTime = currentDate - prevDate
      const diffDays = diffTime / (1000 * 60 * 60 * 24)

      if (diffDays === 1) {
        currentStreak++
      } else {
        longestStreak = Math.max(longestStreak, currentStreak)
        currentStreak = 1
      }
    }

    return Math.max(longestStreak, currentStreak)
  }

  // Convert to JSON (remove sensitive data if needed)
  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      name: this.name,
      type: this.type,
      color: this.color,
      icon: this.icon,
      created_at: this.created_at,
      archived: this.archived,
      selected_goal_name: this.selected_goal_name,
      selected_goal_hours: this.selected_goal_hours,
      abstinence_text: this.abstinence_text,
      use_default_abstinence_text: this.use_default_abstinence_text
    }
  }
}

export default Activity