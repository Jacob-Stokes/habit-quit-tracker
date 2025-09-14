// API client for communicating with the backend
class API {
  constructor() {
    this.baseURL = '/api'
  }

  // Helper method to make HTTP requests
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include', // Include cookies for session
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed')
      }

      return data
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Authentication methods
  async register(username, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: { username, password }
    })
  }

  async login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { username, password }
    })
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST'
    })
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async checkAuthStatus() {
    return this.request('/auth/status')
  }

  // Activity methods
  async getActivities(options = {}) {
    const params = new URLSearchParams()
    if (options.includeStats) params.append('include_stats', 'true')
    if (options.includeLastEvent) params.append('include_last_event', 'true')
    
    const query = params.toString()
    return this.request(`/activities${query ? '?' + query : ''}`)
  }

  async getActivity(id) {
    return this.request(`/activities/${id}`)
  }

  async createActivity(activityData) {
    return this.request('/activities', {
      method: 'POST',
      body: activityData
    })
  }

  async updateActivity(id, activityData) {
    return this.request(`/activities/${id}`, {
      method: 'PUT',
      body: activityData
    })
  }

  async deleteActivity(id) {
    return this.request(`/activities/${id}`, {
      method: 'DELETE'
    })
  }

  async getActivityStats(id) {
    return this.request(`/activities/${id}/stats`)
  }

  async updateActivityGoal(id, goalName, goalHours) {
    return this.request(`/activities/${id}/goal`, {
      method: 'PATCH',
      body: { goal_name: goalName, goal_hours: goalHours }
    })
  }

  // Event methods
  async getEvents(options = {}) {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit)
    if (options.offset) params.append('offset', options.offset)
    if (options.activityId) params.append('activity_id', options.activityId)
    if (options.includeActivity) params.append('include_activity', 'true')
    if (options.today) params.append('today', 'true')
    
    const query = params.toString()
    return this.request(`/events${query ? '?' + query : ''}`)
  }

  async createEvent(eventData) {
    return this.request('/events', {
      method: 'POST',
      body: eventData
    })
  }

  async quickLog(activityId) {
    return this.request('/events/quick-log', {
      method: 'POST',
      body: { activity_id: activityId }
    })
  }

  async updateEvent(id, eventData) {
    return this.request(`/events/${id}`, {
      method: 'PUT',
      body: eventData
    })
  }

  async deleteEvent(id) {
    return this.request(`/events/${id}`, {
      method: 'DELETE'
    })
  }

  async getEventsInDateRange(activityId, startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    })
    return this.request(`/events/activity/${activityId}/range?${params}`)
  }

  // Health check
  async healthCheck() {
    return this.request('/health')
  }

  // API Key methods
  async getApiKeys() {
    return this.request('/apikeys')
  }

  async createApiKey(name) {
    return this.request('/apikeys', {
      method: 'POST',
      body: { name }
    })
  }

  async deleteApiKey(keyId) {
    return this.request(`/apikeys/${keyId}`, {
      method: 'DELETE'
    })
  }

  // User preferences
  async updatePreferences(preferences) {
    return this.request('/auth/preferences', {
      method: 'PUT',
      body: preferences
    })
  }

  async restoreDefaultPreferences() {
    return this.request('/auth/preferences/restore-defaults', {
      method: 'POST'
    })
  }
}

// Create a global API instance
window.api = new API()