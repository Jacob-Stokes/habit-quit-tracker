import database from '../config/database.js'

class SystemSettings {
  // Get a setting by key
  static async get(key) {
    const row = await database.get(
      'SELECT value FROM system_settings WHERE key = ?',
      [key]
    )

    return row ? row.value : null
  }

  // Set a setting value
  static async set(key, value, userId = null) {
    const existingValue = await this.get(key)

    if (existingValue !== null) {
      // Update existing
      await database.run(
        'UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE key = ?',
        [value, userId, key]
      )
    } else {
      // Insert new
      await database.run(
        'INSERT INTO system_settings (key, value, updated_by) VALUES (?, ?, ?)',
        [key, value, userId]
      )
    }

    return true
  }

  // Get all settings
  static async getAll() {
    const rows = await database.all('SELECT key, value FROM system_settings')

    // Convert to object for easier access
    const settings = {}
    rows.forEach(row => {
      settings[row.key] = row.value
    })

    return settings
  }

  // Check if signup is disabled
  static async isSignupDisabled() {
    const value = await this.get('signup_disabled')
    return value === 'true'
  }

  // Toggle signup
  static async setSignupDisabled(disabled, userId = null) {
    return await this.set('signup_disabled', disabled ? 'true' : 'false', userId)
  }
}

export default SystemSettings