import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import database from '../config/database.js'

class User {
  constructor(data) {
    this.id = data.id
    this.username = data.username
    this.password_hash = data.password_hash
    this.default_abstinence_text = data.default_abstinence_text || 'Abstinence time'
    this.show_habits_tab = data.show_habits_tab !== 0
    this.show_quits_tab = data.show_quits_tab !== 0
    this.show_logs_tab = data.show_logs_tab !== 0
    this.custom_title = data.custom_title || 'Habit Tracker'
    this.show_title_section = data.show_title_section !== 0
    this.selected_theme = data.selected_theme || 'light'
    this.created_at = data.created_at
  }

  // Create a new user
  static async create(username, password) {
    try {
      // Hash password
      const saltRounds = 12
      const password_hash = await bcrypt.hash(password, saltRounds)
      
      const id = uuidv4()
      
      const result = await database.run(
        'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
        [id, username, password_hash]
      )
      
      return await User.findById(id)
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Username already exists')
      }
      throw error
    }
  }

  // Find user by ID
  static async findById(id) {
    const row = await database.get(
      'SELECT * FROM users WHERE id = ?',
      [id]
    )
    
    return row ? new User(row) : null
  }

  // Find user by username
  static async findByUsername(username) {
    const row = await database.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )
    
    return row ? new User(row) : null
  }

  // Verify password
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password_hash)
  }

  // Get user without sensitive data
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      default_abstinence_text: this.default_abstinence_text,
      show_habits_tab: this.show_habits_tab,
      show_quits_tab: this.show_quits_tab,
      show_logs_tab: this.show_logs_tab,
      custom_title: this.custom_title,
      show_title_section: this.show_title_section,
      selected_theme: this.selected_theme,
      created_at: this.created_at
    }
  }

  // Update user preferences
  static async updatePreferences(userId, preferences) {
    if (!userId) {
      throw new Error('User ID is required')
    }

    const updates = []
    const values = []

    if (preferences.defaultAbstinenceText !== undefined) {
      updates.push('default_abstinence_text = ?')
      values.push(preferences.defaultAbstinenceText)
    }

    if (preferences.showHabitsTab !== undefined) {
      updates.push('show_habits_tab = ?')
      values.push(preferences.showHabitsTab ? 1 : 0)
    }

    if (preferences.showQuitsTab !== undefined) {
      updates.push('show_quits_tab = ?')
      values.push(preferences.showQuitsTab ? 1 : 0)
    }

    if (preferences.showLogsTab !== undefined) {
      updates.push('show_logs_tab = ?')
      values.push(preferences.showLogsTab ? 1 : 0)
    }

    if (preferences.customTitle !== undefined) {
      updates.push('custom_title = ?')
      values.push(preferences.customTitle)
    }

    if (preferences.showTitleSection !== undefined) {
      updates.push('show_title_section = ?')
      values.push(preferences.showTitleSection ? 1 : 0)
    }

    if (preferences.selectedTheme !== undefined) {
      updates.push('selected_theme = ?')
      values.push(preferences.selectedTheme)
    }

    if (updates.length === 0) {
      return true
    }

    values.push(userId)

    await database.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return true
  }

  // Update user
  async update(data) {
    const allowedFields = ['username']
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

    try {
      await database.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
      
      return await User.findById(this.id)
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Username already exists')
      }
      throw error
    }
  }

  // Delete user (soft delete by deactivating)
  async delete() {
    await database.run(
      'DELETE FROM users WHERE id = ?',
      [this.id]
    )
  }
}

export default User