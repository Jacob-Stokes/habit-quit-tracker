import { v4 as uuidv4 } from 'uuid'
import database from '../config/database.js'

class Event {
  constructor(data) {
    this.id = data.id
    this.activity_id = data.activity_id
    this.timestamp = data.timestamp
    this.note = data.note
  }

  // Create a new event
  static async create(activityId, eventData = {}) {
    const { timestamp = new Date().toISOString(), note = null } = eventData
    
    const id = uuidv4()

    await database.run(
      'INSERT INTO events (id, activity_id, timestamp, note) VALUES (?, ?, ?, ?)',
      [id, activityId, timestamp, note]
    )

    return await Event.findById(id)
  }

  // Find event by ID
  static async findById(id) {
    const row = await database.get(
      'SELECT * FROM events WHERE id = ?',
      [id]
    )
    
    return row ? new Event(row) : null
  }

  // Find event by ID and verify it belongs to the user (through activity)
  static async findByIdAndUser(id, userId) {
    const row = await database.get(`
      SELECT e.* 
      FROM events e
      JOIN activities a ON e.activity_id = a.id
      WHERE e.id = ? AND a.user_id = ?
    `, [id, userId])
    
    return row ? new Event(row) : null
  }

  // Get all events for an activity
  static async findByActivityId(activityId, limit = null, offset = 0) {
    let sql = 'SELECT * FROM events WHERE activity_id = ? ORDER BY timestamp DESC'
    const params = [activityId]

    if (limit) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    const rows = await database.all(sql, params)
    return rows.map(row => new Event(row))
  }

  // Get events for an activity within a date range
  static async findByActivityIdAndDateRange(activityId, startDate, endDate) {
    const rows = await database.all(`
      SELECT * FROM events 
      WHERE activity_id = ? 
      AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `, [activityId, startDate, endDate])
    
    return rows.map(row => new Event(row))
  }

  static async findByActivityIdAndDate(activityId, date) {
    const rows = await database.all(`
      SELECT * FROM events
      WHERE activity_id = ?
      AND DATE(timestamp) = DATE(?)
      ORDER BY timestamp DESC
    `, [activityId, date])

    return rows.map(row => new Event(row))
  }

  static async countByActivityIdAndDate(activityId, date) {
    const row = await database.get(`
      SELECT COUNT(*) as count
      FROM events
      WHERE activity_id = ?
        AND DATE(timestamp) = DATE(?)
    `, [activityId, date])

    return row?.count || 0
  }

  static async deleteByIds(ids = []) {
    if (!ids || ids.length === 0) return 0

    const placeholders = ids.map(() => '?').join(', ')
    const result = await database.run(
      `DELETE FROM events WHERE id IN (${placeholders})`,
      ids
    )

    return result.changes || 0
  }

  static async deleteByActivityIdAndDate(activityId, date) {
    const result = await database.run(`
      DELETE FROM events
      WHERE activity_id = ?
      AND DATE(timestamp) = DATE(?)
    `, [activityId, date])

    return result.changes || 0
  }

  // Get events for all user's activities
  static async findByUserId(userId, limit = null, offset = 0) {
    let sql = `
      SELECT e.* 
      FROM events e
      JOIN activities a ON e.activity_id = a.id
      WHERE a.user_id = ? 
      ORDER BY e.timestamp DESC
    `
    const params = [userId]

    if (limit) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    const rows = await database.all(sql, params)
    return rows.map(row => new Event(row))
  }

  // Get events with activity information
  static async findByUserIdWithActivity(userId, limit = null, offset = 0) {
    let sql = `
      SELECT 
        e.*,
        a.name as activity_name,
        a.type as activity_type,
        a.color as activity_color,
        a.icon as activity_icon
      FROM events e
      JOIN activities a ON e.activity_id = a.id
      WHERE a.user_id = ? AND a.archived = 0
      ORDER BY e.timestamp DESC
    `
    const params = [userId]

    if (limit) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    const rows = await database.all(sql, params)
    return rows.map(row => ({
      ...new Event(row),
      activity: {
        id: row.activity_id,
        name: row.activity_name,
        type: row.activity_type,
        color: row.activity_color,
        icon: row.activity_icon
      }
    }))
  }

  // Get events for today
  static async findTodayByUserId(userId) {
    const today = new Date().toISOString().split('T')[0]
    const rows = await database.all(`
      SELECT 
        e.*,
        a.name as activity_name,
        a.type as activity_type,
        a.color as activity_color,
        a.icon as activity_icon
      FROM events e
      JOIN activities a ON e.activity_id = a.id
      WHERE a.user_id = ? AND a.archived = 0
      AND DATE(e.timestamp) = ?
      ORDER BY e.timestamp DESC
    `, [userId, today])

    return rows.map(row => ({
      ...new Event(row),
      activity: {
        id: row.activity_id,
        name: row.activity_name,
        type: row.activity_type,
        color: row.activity_color,
        icon: row.activity_icon
      }
    }))
  }

  // Update event
  async update(data) {
    const allowedFields = ['timestamp', 'note']
    const updates = []
    const values = []

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(data[field])
      }
    }

    if (updates.length === 0) {
      return this
    }

    values.push(this.id)

    await database.run(
      `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return await Event.findById(this.id)
  }

  // Delete event
  async delete() {
    await database.run(
      'DELETE FROM events WHERE id = ?',
      [this.id]
    )
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      activity_id: this.activity_id,
      timestamp: this.timestamp,
      note: this.note
    }
  }
}

export default Event
