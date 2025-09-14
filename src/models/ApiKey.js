import database from '../config/database.js'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

class ApiKey {
  static async create(userId, name) {
    const id = uuidv4()
    // Generate a secure random API key
    const apiKey = crypto.randomBytes(32).toString('hex')
    // Hash the key for storage (we'll only show it once)
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    await database.run(
      'INSERT INTO api_keys (id, user_id, name, key_hash) VALUES (?, ?, ?, ?)',
      [id, userId, name, keyHash]
    )

    // Return the unhashed key (only shown once!)
    return {
      id,
      name,
      apiKey: `hqt_${apiKey}`, // prefix for easy identification
      created_at: new Date().toISOString()
    }
  }

  static async findByUserId(userId) {
    return database.all(
      `SELECT id, name, last_used, created_at
       FROM api_keys
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    )
  }

  static async verifyKey(apiKey) {
    // Remove prefix if present
    const cleanKey = apiKey.replace('hqt_', '')
    const keyHash = crypto.createHash('sha256').update(cleanKey).digest('hex')

    const result = await database.get(
      `SELECT ak.*, u.username, u.id as user_id
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = ?`,
      [keyHash]
    )

    if (result) {
      // Update last used timestamp
      await database.run(
        'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
        [result.id]
      )
    }

    return result
  }

  static async delete(id, userId) {
    const result = await database.run(
      'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    return result.changes > 0
  }
}

export default ApiKey