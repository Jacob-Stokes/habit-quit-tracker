import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import database from '../config/database.js'

class User {
  constructor(data) {
    this.id = data.id
    this.username = data.username
    this.password_hash = data.password_hash
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
      created_at: this.created_at
    }
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