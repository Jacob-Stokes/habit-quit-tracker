// Authentication middleware to protect routes
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    })
  }
  
  // Add user ID to request for easy access in route handlers
  req.userId = req.session.userId
  next()
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