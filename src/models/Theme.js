import { v4 as uuidv4 } from 'uuid'
import database from '../config/database.js'

class Theme {
  constructor(data) {
    this.id = data.id
    this.user_id = data.user_id
    this.name = data.name
    this.is_default = data.is_default
    this.colors = typeof data.colors === 'string' ? JSON.parse(data.colors) : data.colors
    this.created_at = data.created_at
  }

  // Create a new theme
  static async create(userId, themeData) {
    const { name, colors } = themeData

    if (!name || !colors) {
      throw new Error('Name and colors are required')
    }

    const id = uuidv4()
    const colorsJson = JSON.stringify(colors)

    await database.run(
      'INSERT INTO themes (id, user_id, name, colors) VALUES (?, ?, ?, ?)',
      [id, userId, name, colorsJson]
    )

    return await Theme.findById(id)
  }

  // Find theme by ID
  static async findById(id) {
    const row = await database.get(
      'SELECT * FROM themes WHERE id = ?',
      [id]
    )

    return row ? new Theme(row) : null
  }

  // Get all themes for a user plus default themes
  static async findByUserId(userId) {
    const rows = await database.all(
      'SELECT * FROM themes WHERE user_id = ? OR is_default = 1 ORDER BY is_default DESC, created_at DESC',
      [userId]
    )

    return rows.map(row => new Theme(row))
  }

  // Update theme
  async update(data) {
    const updates = []
    const values = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name)
    }

    if (data.colors !== undefined) {
      updates.push('colors = ?')
      values.push(JSON.stringify(data.colors))
    }

    if (updates.length === 0) {
      return this
    }

    values.push(this.id)

    await database.run(
      `UPDATE themes SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return await Theme.findById(this.id)
  }

  // Delete theme
  async delete() {
    await database.run(
      'DELETE FROM themes WHERE id = ?',
      [this.id]
    )
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      name: this.name,
      is_default: this.is_default,
      colors: this.colors,
      created_at: this.created_at
    }
  }

  // Get default themes
  static getBuiltInThemes() {
    return {
      light: {
        name: 'Light',
        colors: {
          // Background colors
          bgPrimary: '#ffffff',
          bgSecondary: '#f8f9fa',
          bgTertiary: '#e9ecef',

          // Text colors
          textPrimary: '#212529',
          textSecondary: '#495057',
          textMuted: '#6c757d',

          // Brand colors
          primary: '#6366f1',
          primaryHover: '#4f46e5',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',

          // UI elements
          border: '#dee2e6',
          borderLight: '#e9ecef',
          shadow: 'rgba(0, 0, 0, 0.1)',

          // Activity colors (for charts/progress)
          habitColor: '#10b981',
          quitColor: '#ef4444'
        }
      },
      dark: {
        name: 'Dark',
        colors: {
          // Background colors
          bgPrimary: '#1a1a1a',
          bgSecondary: '#2d2d2d',
          bgTertiary: '#404040',

          // Text colors
          textPrimary: '#ffffff',
          textSecondary: '#d1d5db',
          textMuted: '#9ca3af',

          // Brand colors
          primary: '#818cf8',
          primaryHover: '#6366f1',
          success: '#34d399',
          warning: '#fbbf24',
          danger: '#f87171',

          // UI elements
          border: '#404040',
          borderLight: '#525252',
          shadow: 'rgba(0, 0, 0, 0.3)',

          // Activity colors
          habitColor: '#34d399',
          quitColor: '#f87171'
        }
      },
      ocean: {
        name: 'Ocean',
        colors: {
          // Background colors
          bgPrimary: '#f0f9ff',
          bgSecondary: '#e0f2fe',
          bgTertiary: '#bae6fd',

          // Text colors
          textPrimary: '#0c4a6e',
          textSecondary: '#075985',
          textMuted: '#0284c7',

          // Brand colors
          primary: '#0ea5e9',
          primaryHover: '#0284c7',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',

          // UI elements
          border: '#7dd3fc',
          borderLight: '#bae6fd',
          shadow: 'rgba(14, 165, 233, 0.1)',

          // Activity colors
          habitColor: '#06b6d4',
          quitColor: '#f97316'
        }
      }
    }
  }
}

export default Theme