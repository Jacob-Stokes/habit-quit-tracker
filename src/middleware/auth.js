import ApiKey from '../models/ApiKey.js'

// Authentication middleware to protect routes (supports both session and API key)
const requireAuth = async (req, res, next) => {
  // Check for API key in headers
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')

  if (apiKey) {
    try {
      const keyData = await ApiKey.verifyKey(apiKey)
      if (keyData) {
        req.userId = keyData.user_id
        req.username = keyData.username
        req.authMethod = 'apikey'
        return next()
      }
    } catch (error) {
      console.error('API key verification error:', error)
    }
  }

  // Check for session auth
  if (req.session && req.session.userId) {
    req.userId = req.session.userId
    req.authMethod = 'session'
    return next()
  }

  return res.status(401).json({
    error: 'Authentication required',
    message: 'Please provide a valid API key or log in to access this resource'
  })
}

// Optional authentication - adds user info if logged in but doesn't require it
const optionalAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId
  }
  next()
}

// Check if user is already logged in (for login/register routes)
const requireGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.status(400).json({ 
      error: 'Already authenticated',
      message: 'You are already logged in'
    })
  }
  next()
}

export {
  requireAuth,
  optionalAuth,
  requireGuest
}