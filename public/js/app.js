// Main application logic
class HabitTracker {
  constructor() {
    this.currentUser = null
    this.activities = []
    this.todayEvents = []
    this.updateTimer = null
    
    this.initializeApp()
  }

  async initializeApp() {
    try {
      // Check authentication status
      const authStatus = await api.checkAuthStatus()
      
      if (authStatus.authenticated) {
        await this.loadUserData()
        this.showMainApp()
      } else {
        this.showAuthForms()
      }
    } catch (error) {
      console.error('Initialization error:', error)
      this.showAuthForms()
    } finally {
      this.hideLoading()
    }

    this.setupEventListeners()
    
    // Initialize view state
    this.currentView = 'cards'
  }

  async loadUserData() {
    try {
      // Load current user
      const userResponse = await api.getCurrentUser()
      this.currentUser = userResponse.user

      // Load activities with stats and last event
      const activitiesResponse = await api.getActivities({
        includeStats: true,
        includeLastEvent: true
      })
      this.activities = activitiesResponse.activities

      // Load today's events
      const eventsResponse = await api.getEvents({
        today: true,
        includeActivity: true
      })
      this.todayEvents = eventsResponse.events

      // Set selected goals from database data
      this.activities.forEach(activity => {
        if (activity.type === 'quit' && activity.selected_goal_name && activity.selected_goal_hours) {
          activity.selectedGoal = {
            name: activity.selected_goal_name,
            hours: activity.selected_goal_hours
          }
        }
      })

      this.renderActivities()
      this.renderTodayEvents()
      
      // Restore the active tab from localStorage
      this.restoreActiveTab()
      
      this.startLiveUpdates()
    } catch (error) {
      console.error('Error loading user data:', error)
      this.showMessage('Failed to load data', 'error')
    }
  }

  startLiveUpdates() {
    // Update time displays every second
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
    }
    
    this.updateTimer = setInterval(() => {
      this.updateTimeDisplays()
    }, 1000)
  }

  stopLiveUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  updateTimeDisplays() {
    // Update all quit activities' time displays
    this.activities.forEach(activity => {
      if (activity.type === 'quit') {
        // Use selected goal if available, otherwise calculate default
        let timeData
        if (activity.selectedGoal) {
          timeData = this.calculateTimeDisplayWithGoal(activity, activity.lastEvent, activity.selectedGoal.hours, activity.selectedGoal.name)
        } else {
          timeData = this.calculateTimeDisplay(activity, activity.lastEvent)
        }
        
        // Update card view elements (activity cards)
        const card = document.querySelector(`[data-activity-id="${activity.id}"]`)?.closest('.activity-card')
        if (card) {
          const timeDisplay = card.querySelector('.time-display, .time-display-large')
          const progressPercent = card.querySelector('.progress-percent')
          const progressGoal = card.querySelector('.progress-goal')
          const progressCircle = card.querySelector('circle[stroke-dasharray]')
          
          if (timeDisplay) timeDisplay.textContent = timeData.timeString
          if (progressPercent) progressPercent.textContent = `${timeData.progressPercent.toFixed(1)}%`
          if (progressGoal) progressGoal.textContent = timeData.currentGoal
          if (progressCircle) {
            const circumference = 2 * Math.PI * (progressCircle.getAttribute('r') || 40)
            progressCircle.style.strokeDashoffset = circumference * (1 - timeData.progressPercent / 100)
          }
        }
        
        // Update calendar view elements (full-screen calendar view)
        if (this.currentCalendarActivity === activity.id) {
          const calendarTimeDisplay = document.querySelector('.fullscreen-calendar-view .time-display')
          const calendarProgressPercent = document.querySelector('.fullscreen-calendar-view .progress-percent')
          const calendarProgressGoal = document.querySelector('.fullscreen-calendar-view .progress-goal')
          const calendarProgressCircle = document.querySelector('.fullscreen-calendar-view circle[stroke-dasharray]')
          
          if (calendarTimeDisplay) calendarTimeDisplay.textContent = timeData.timeString
          if (calendarProgressPercent) calendarProgressPercent.textContent = `${timeData.progressPercent.toFixed(1)}%`
          if (calendarProgressGoal) calendarProgressGoal.textContent = timeData.currentGoal
          if (calendarProgressCircle) {
            const circumference = 2 * Math.PI * (calendarProgressCircle.getAttribute('r') || 50)
            calendarProgressCircle.style.strokeDashoffset = circumference * (1 - timeData.progressPercent / 100)
          }
        }
        
        // Update table view elements if in table view
        const tableRow = document.querySelector(`tr[data-activity-id="${activity.id}"]`)
        if (tableRow) {
          const tableTimeDisplay = tableRow.querySelector('.table-time')
          const tableProgressDisplay = tableRow.querySelector('.table-progress')
          
          if (tableTimeDisplay) tableTimeDisplay.textContent = timeData.timeString
          if (tableProgressDisplay) {
            const progressDisplay = `${timeData.progressPercent.toFixed(1)}% of ${timeData.currentGoal}`
            tableProgressDisplay.textContent = progressDisplay
          }
        }
      }
    })
  }

  setupEventListeners() {
    // Auth form switching
    document.getElementById('show-register')?.addEventListener('click', (e) => {
      e.preventDefault()
      this.showRegisterForm()
    })

    document.getElementById('show-login')?.addEventListener('click', (e) => {
      e.preventDefault()
      this.showLoginForm()
    })

    // Auth forms submission
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleLogin(e.target)
    })

    document.getElementById('register-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleRegister(e.target)
    })

    // Main app actions
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.handleLogout()
    })

    document.getElementById('add-activity-btn')?.addEventListener('click', () => {
      this.showActivityModal()
    })

    // Modal actions
    document.getElementById('close-modal')?.addEventListener('click', () => {
      this.hideActivityModal()
    })

    document.getElementById('cancel-modal')?.addEventListener('click', () => {
      this.hideActivityModal()
    })

    document.getElementById('activity-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'activity-modal') {
        this.hideActivityModal()
      }
    })

    document.getElementById('activity-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleActivitySubmit(e.target)
    })

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.dataset.tab
        this.switchTab(targetTab)
      })
    })

    // View toggle switching
    document.querySelectorAll('.view-toggle-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const targetView = e.currentTarget.dataset.view
        this.switchView(targetView)
      })
    })

    // Add Activity buttons in empty states
    document.querySelector('.add-habit-btn')?.addEventListener('click', () => {
      this.showActivityModal(null, 'habit')
    })

    document.querySelector('.add-quit-btn')?.addEventListener('click', () => {
      this.showActivityModal(null, 'quit')
    })

    // Header menu functionality
    document.getElementById('header-menu-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggleHeaderMenu()
    })

    // Close header menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.header-menu')) {
        this.hideHeaderMenu()
      }
    })
  }

  toggleHeaderMenu() {
    const dropdown = document.getElementById('header-dropdown')
    if (dropdown) {
      const isVisible = dropdown.style.display !== 'none'
      dropdown.style.display = isVisible ? 'none' : 'block'
    }
  }

  hideHeaderMenu() {
    const dropdown = document.getElementById('header-dropdown')
    if (dropdown) {
      dropdown.style.display = 'none'
    }
  }

  switchTab(targetTab) {
    // Exit calendar view if currently active
    if (this.currentCalendarActivity) {
      this.returnToTabView()
    }
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active')
      if (btn.dataset.tab === targetTab) {
        btn.classList.add('active')
      }
    })

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active')
    })
    document.getElementById(`${targetTab}-tab`).classList.add('active')

    // Re-render the target tab with current view setting
    if (targetTab !== 'logs') {
      this.renderActivitiesInTab(targetTab)
    }

    // Save the current tab to localStorage
    localStorage.setItem('activeTab', targetTab)
  }

  restoreActiveTab() {
    // Get the saved tab from localStorage, default to 'habits'
    const savedTab = localStorage.getItem('activeTab') || 'habits'
    this.switchTab(savedTab)
  }

  // Authentication methods
  showAuthForms() {
    document.getElementById('auth-container').style.display = 'flex'
    document.getElementById('main-app').style.display = 'none'
  }

  showMainApp() {
    document.getElementById('auth-container').style.display = 'none'
    document.getElementById('main-app').style.display = 'flex'
  }

  showLoginForm() {
    document.getElementById('login-form').style.display = 'block'
    document.getElementById('register-form').style.display = 'none'
  }

  showRegisterForm() {
    document.getElementById('login-form').style.display = 'none'
    document.getElementById('register-form').style.display = 'block'
  }

  async handleLogin(form) {
    try {
      const formData = new FormData(form)
      const username = formData.get('username')
      const password = formData.get('password')

      const response = await api.login(username, password)
      this.currentUser = response.user
      
      await this.loadUserData()
      this.showMainApp()
      this.showMessage('Login successful!', 'success')
    } catch (error) {
      console.error('Login error:', error)
      this.showMessage(error.message || 'Login failed', 'error')
    }
  }

  async handleRegister(form) {
    try {
      const formData = new FormData(form)
      const username = formData.get('username')
      const password = formData.get('password')
      const confirmPassword = formData.get('password-confirm')

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const response = await api.register(username, password)
      this.currentUser = response.user
      
      await this.loadUserData()
      this.showMainApp()
      this.showMessage('Account created successfully!', 'success')
    } catch (error) {
      console.error('Register error:', error)
      this.showMessage(error.message || 'Registration failed', 'error')
    }
  }

  async handleLogout() {
    try {
      await api.logout()
      this.stopLiveUpdates()
      this.currentUser = null
      this.activities = []
      this.todayEvents = []
      this.showAuthForms()
      this.showMessage('Logged out successfully', 'success')
    } catch (error) {
      console.error('Logout error:', error)
      this.showMessage('Logout failed', 'error')
    }
  }

  async showActivityDetails(activityId) {
    const activity = this.activities.find(a => a.id === activityId)
    if (!activity) return

    // Switch the entire tab content area to calendar view mode
    await this.renderFullScreenCalendarView(activityId)
  }

  async renderFullScreenCalendarView(activityId) {
    const activity = this.activities.find(a => a.id === activityId)
    if (!activity) return

    // Add calendar view class to body for mobile scroll handling
    document.body.classList.add('calendar-view-active')

    // Get events for the past 3 months to show in calendar
    const currentDate = new Date()
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    let events = []
    try {
      const eventsResponse = await api.getEventsInDateRange(
        activityId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      events = eventsResponse.events || []
    } catch (error) {
      console.error('Failed to load events for calendar:', error)
    }

    // Calculate current time data for progress circle
    let timeData
    if (activity.type === 'quit' && activity.selectedGoal) {
      timeData = this.calculateTimeDisplayWithGoal(activity, activity.lastEvent, activity.selectedGoal.hours, activity.selectedGoal.name)
    } else {
      timeData = this.calculateTimeDisplay(activity, activity.lastEvent)
    }

    // Replace the entire tab content area with calendar view
    const tabContent = document.querySelector('.tab-content')
    if (!tabContent) return

    // Store the original content so we can restore it later
    this.originalTabContent = tabContent.innerHTML
    this.currentCalendarActivity = activityId

    // Replace with full-screen calendar view
    tabContent.innerHTML = `
      <div class="fullscreen-calendar-view">
        <div class="calendar-header">
          <button class="btn btn-secondary back-btn" data-activity-id="${activityId}">← Back</button>
          <h2>${activity.name}</h2>
        </div>
        
        ${activity.type === 'quit' ? this.renderProgressCircleWithGoalSelection(timeData, activity.color, activityId) : ''}
        
        <div class="calendar-container">
          <div class="calendar-nav">
            <button class="btn btn-sm" id="prev-month">‹</button>
            <span id="current-month">${this.getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}</span>
            <button class="btn btn-sm" id="next-month">›</button>
          </div>
          
          ${this.renderCalendar(currentDate, events)}
        </div>
      </div>
    `

    // Add event listeners for calendar navigation
    tabContent.querySelector('#prev-month').addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1)
      this.updateFullScreenCalendar(tabContent, currentDate, events)
    })

    tabContent.querySelector('#next-month').addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1)
      this.updateFullScreenCalendar(tabContent, currentDate, events)
    })

    // Add back button listener
    tabContent.querySelector('.back-btn').addEventListener('click', () => {
      this.returnToTabView()
    })

    // Add goal selection listeners for calendar view
    this.addCalendarGoalListeners(tabContent)
  }

  updateFullScreenCalendar(container, date, events) {
    const monthSpan = container.querySelector('#current-month')
    const calendarContainer = container.querySelector('.calendar-container')
    
    monthSpan.textContent = `${this.getMonthName(date.getMonth())} ${date.getFullYear()}`
    
    const newCalendar = this.renderCalendar(date, events)
    const existingCalendar = calendarContainer.querySelector('.calendar-grid')
    existingCalendar.outerHTML = newCalendar
  }

  returnToTabView() {
    const tabContent = document.querySelector('.tab-content')
    if (!tabContent || !this.originalTabContent) return

    // Remove calendar view class from body
    document.body.classList.remove('calendar-view-active')

    // Restore the original tab content
    tabContent.innerHTML = this.originalTabContent

    // Re-render activities to restore event listeners
    this.renderActivities()

    // Clear stored content
    this.originalTabContent = null
    this.currentCalendarActivity = null
  }

  returnToNormalView(activityId) {
    const activity = this.activities.find(a => a.id === activityId)
    if (!activity) return

    const activityCard = document.querySelector('.calendar-view').closest('.activity-card')
    if (!activityCard) return

    // Restore the original activity card content
    activityCard.innerHTML = this.getActivityCardContent(activity)

    // Re-add event listeners
    this.addActivityCardListeners(activityCard, activity)
  }

  getActivityCardContent(activity) {
    const lastEvent = activity.lastEvent
    const stats = activity.statistics || {}
    
    let timeData
    if (activity.type === 'quit' && activity.selectedGoal) {
      timeData = this.calculateTimeDisplayWithGoal(activity, lastEvent, activity.selectedGoal.hours, activity.selectedGoal.name)
    } else {
      timeData = this.calculateTimeDisplay(activity, lastEvent)
    }
    
    return `
      <div class="activity-header">
        <div class="activity-info">
          <div class="activity-name">
            ${activity.icon ? `<span>${activity.icon}</span>` : ''}
            ${activity.name}
          </div>
          <span class="activity-type ${activity.type}">${activity.type}</span>
        </div>
      </div>
      
      ${activity.type === 'quit' ? this.renderQuitDisplay(timeData, activity.color, activity.id) : this.renderHabitDisplay(stats)}

      <div class="activity-actions">
        <button class="btn log-btn ${activity.type}" data-activity-id="${activity.id}">
          ${activity.type === 'habit' ? '✓ Did it!' : '⚠️ Slipped up'}
        </button>
        <button class="btn btn-secondary btn-sm view-btn" data-activity-id="${activity.id}">View Details</button>
        <button class="btn btn-secondary btn-sm edit-btn" data-activity-id="${activity.id}">Edit</button>
        <button class="btn btn-danger btn-sm delete-btn" data-activity-id="${activity.id}">Delete</button>
      </div>
    `
  }

  addActivityCardListeners(activityCard, activity) {
    // Log button
    const logBtn = activityCard.querySelector('.log-btn')
    if (logBtn) {
      logBtn.addEventListener('click', () => this.handleQuickLog(activity.id))
    }

    // View button
    const viewBtn = activityCard.querySelector('.view-btn')
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.showActivityDetails(activity.id))
    }

    // Edit button
    const editBtn = activityCard.querySelector('.edit-btn')
    if (editBtn) {
      editBtn.addEventListener('click', () => this.showEditActivityForm(activity.id))
    }

    // Delete button
    const deleteBtn = activityCard.querySelector('.delete-btn')
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteActivity(activity.id))
    }

    // Goal selection for quit activities
    if (activity.type === 'quit') {
      const progressCircle = activityCard.querySelector('.progress-circle')
      if (progressCircle) {
        progressCircle.addEventListener('click', () => this.showGoalSelection(activity.id))
      }
    }
  }

  renderProgressCircle(timeData, color) {
    const progressColor = color || '#ef4444'
    
    return `
      <div class="progress-section">
        <div class="progress-circle-container">
          <div class="progress-circle">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" stroke-width="8"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="${progressColor}" stroke-width="8"
                stroke-dasharray="${2 * Math.PI * 50}" 
                stroke-dashoffset="${2 * Math.PI * 50 * (1 - timeData.progressPercent / 100)}"
                stroke-linecap="round" transform="rotate(-90 60 60)"/>
            </svg>
            <div class="progress-content">
              <div class="progress-percent">${timeData.progressPercent.toFixed(1)}%</div>
              <div class="progress-goal">${timeData.currentGoal}</div>
            </div>
          </div>
        </div>
        <div class="abstinence-time">
          <div class="abstinence-label">Abstinence Time</div>
          <div class="time-display">${timeData.timeString}</div>
        </div>
      </div>
    `
  }

  renderProgressCircleWithGoalSelection(timeData, color, activityId) {
    const progressColor = color || '#ef4444'
    
    return `
      <div class="progress-section">
        <div class="progress-circle-container" data-activity-id="${activityId}">
          <div class="progress-circle clickable-progress">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" stroke-width="8"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="${progressColor}" stroke-width="8"
                stroke-dasharray="${2 * Math.PI * 50}" 
                stroke-dashoffset="${2 * Math.PI * 50 * (1 - timeData.progressPercent / 100)}"
                stroke-linecap="round" transform="rotate(-90 60 60)"/>
            </svg>
            <div class="progress-content">
              <div class="progress-percent">${timeData.progressPercent.toFixed(1)}%</div>
              <div class="progress-goal clickable-goal">${timeData.currentGoal}</div>
            </div>
          </div>
          
          <!-- Goal Selection Dropdown -->
          <div class="goal-dropdown calendar-goal-dropdown" id="goal-dropdown-${activityId}" style="display: none;">
            <div class="goal-dropdown-header">
              <span>Choose Goal</span>
              <button class="close-dropdown" data-activity-id="${activityId}">&times;</button>
            </div>
            <div class="goal-options">
              ${this.renderGoalOptions(timeData.totalHours)}
            </div>
          </div>
        </div>
        <div class="abstinence-time">
          <div class="abstinence-label">Abstinence Time</div>
          <div class="time-display">${timeData.timeString}</div>
        </div>
      </div>
    `
  }

  getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[monthIndex]
  }

  renderCalendar(date, events) {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    // Create event map for quick lookup
    const eventDates = new Set()
    events.forEach(event => {
      const eventDate = new Date(event.timestamp).toDateString()
      eventDates.add(eventDate)
    })

    let calendarHTML = `
      <div class="calendar-grid">
        <div class="calendar-header-row">
          <div class="calendar-day-header">Sun</div>
          <div class="calendar-day-header">Mon</div>
          <div class="calendar-day-header">Tue</div>
          <div class="calendar-day-header">Wed</div>
          <div class="calendar-day-header">Thu</div>
          <div class="calendar-day-header">Fri</div>
          <div class="calendar-day-header">Sat</div>
        </div>
        <div class="calendar-days">
    `

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarHTML += '<div class="calendar-day empty"></div>'
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day)
      const dateString = currentDate.toDateString()
      const hasEvent = eventDates.has(dateString)
      const isToday = dateString === new Date().toDateString()
      
      calendarHTML += `
        <div class="calendar-day ${hasEvent ? 'has-event' : ''} ${isToday ? 'today' : ''}">
          <span class="day-number">${day}</span>
          ${hasEvent ? '<div class="event-marker"></div>' : ''}
        </div>
      `
    }

    calendarHTML += `
        </div>
      </div>
    `

    return calendarHTML
  }

  updateCalendar(activityCard, date, events) {
    const monthSpan = activityCard.querySelector('#current-month')
    const calendarContainer = activityCard.querySelector('.calendar-container')
    
    monthSpan.textContent = `${this.getMonthName(date.getMonth())} ${date.getFullYear()}`
    
    const newCalendar = this.renderCalendar(date, events)
    const existingCalendar = calendarContainer.querySelector('.calendar-grid')
    existingCalendar.outerHTML = newCalendar
  }

  // Activity methods
  showActivityModal(activity = null, presetType = null) {
    const modal = document.getElementById('activity-modal')
    const form = document.getElementById('activity-form')
    const title = document.getElementById('modal-title')

    if (activity) {
      title.textContent = 'Edit Activity'
      form.elements.name.value = activity.name
      form.elements.type.value = activity.type
      form.elements.icon.value = activity.icon || ''
      form.elements.color.value = activity.color || '#6366f1'
      form.dataset.activityId = activity.id
    } else {
      title.textContent = 'Add Activity'
      form.reset()
      form.elements.color.value = '#6366f1'
      if (presetType) {
        form.elements.type.value = presetType
      }
      delete form.dataset.activityId
    }

    modal.style.display = 'flex'
  }

  hideActivityModal() {
    document.getElementById('activity-modal').style.display = 'none'
  }

  async handleActivitySubmit(form) {
    try {
      const formData = new FormData(form)
      const activityData = {
        name: formData.get('name'),
        type: formData.get('type'),
        icon: formData.get('icon') || null,
        color: formData.get('color')
      }

      const activityId = form.dataset.activityId

      if (activityId) {
        // Update existing activity
        await api.updateActivity(activityId, activityData)
        this.showMessage('Activity updated successfully!', 'success')
      } else {
        // Create new activity
        await api.createActivity(activityData)
        this.showMessage('Activity created successfully!', 'success')
      }

      this.hideActivityModal()
      await this.loadUserData()
    } catch (error) {
      console.error('Activity submit error:', error)
      this.showMessage(error.message || 'Failed to save activity', 'error')
    }
  }

  async handleQuickLog(activityId) {
    try {
      const response = await api.quickLog(activityId)
      
      // Find the activity and update its lastEvent
      const activityIndex = this.activities.findIndex(a => a.id === activityId)
      if (activityIndex !== -1) {
        this.activities[activityIndex].lastEvent = {
          timestamp: response.event.timestamp,
          note: response.event.note
        }
      }
      
      this.showMessage('Event logged successfully!', 'success')
      
      // Re-render activities to show updated time
      this.renderActivities()
      
      // Also reload today's events
      const eventsResponse = await api.getEvents({
        today: true,
        includeActivity: true
      })
      this.todayEvents = eventsResponse.events
      this.renderTodayEvents()
      
    } catch (error) {
      console.error('Quick log error:', error)
      this.showMessage(error.message || 'Failed to log event', 'error')
    }
  }

  async handleDeleteActivity(activityId) {
    if (!confirm('Are you sure you want to delete this activity? This cannot be undone.')) {
      return
    }

    try {
      await api.deleteActivity(activityId)
      this.showMessage('Activity deleted successfully!', 'success')
      await this.loadUserData()
    } catch (error) {
      console.error('Delete activity error:', error)
      this.showMessage(error.message || 'Failed to delete activity', 'error')
    }
  }

  // Rendering methods
  renderActivities() {
    // Load view preference
    this.currentView = localStorage.getItem('preferredView') || 'cards'
    
    // Filter activities by type
    const habits = this.activities.filter(activity => activity.type === 'habit')
    const quits = this.activities.filter(activity => activity.type === 'quit')

    // Update tab counts
    document.getElementById('habits-count').textContent = habits.length
    document.getElementById('quits-count').textContent = quits.length
    document.getElementById('logs-count').textContent = this.todayEvents.length

    // Update view toggle buttons
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.currentView)
    })

    // Render habits tab
    this.renderActivityTab('habits', habits)
    
    // Render quits tab
    this.renderActivityTab('quits', quits)
  }

  renderActivitiesInTab(tabType) {
    const activities = this.activities.filter(activity => {
      if (tabType === 'habits') return activity.type === 'habit'
      if (tabType === 'quits') return activity.type === 'quit'
      return false
    })
    
    this.renderActivityTab(tabType, activities)
  }

  renderActivityTab(type, activities) {
    const gridContainer = document.getElementById(`${type}-grid`)
    const tableContainer = document.getElementById(`${type}-table`)
    const noActivities = document.getElementById(`no-${type}`)

    if (activities.length === 0) {
      gridContainer.style.display = 'none'
      tableContainer.style.display = 'none'
      noActivities.style.display = 'block'
      return
    }

    noActivities.style.display = 'none'

    // Apply saved order before rendering
    const orderedActivities = this.applySavedOrder(type, activities)

    if (this.currentView === 'table') {
      // Show table view
      gridContainer.style.display = 'none'
      tableContainer.style.display = 'block'
      this.renderActivityTable(tableContainer, orderedActivities)
    } else {
      // Show card view
      gridContainer.style.display = 'grid'
      tableContainer.style.display = 'none'
      gridContainer.innerHTML = orderedActivities.map(activity => this.renderActivityCard(activity)).join('')
      this.addActivityCardContainerListeners(gridContainer)
    }
  }

  renderActivityTable(container, activities) {
    const tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Progress</th>
            <th>Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${activities.map(activity => this.renderActivityTableRow(activity)).join('')}
        </tbody>
      </table>
    `
    
    container.innerHTML = tableHTML
    
    // Add event listeners for table actions
    this.addActivityTableListeners(container)
  }

  renderActivityTableRow(activity) {
    const lastEvent = activity.lastEvent
    let timeData
    if (activity.type === 'quit' && activity.selectedGoal) {
      timeData = this.calculateTimeDisplayWithGoal(activity, lastEvent, activity.selectedGoal.hours, activity.selectedGoal.name)
    } else {
      timeData = this.calculateTimeDisplay(activity, lastEvent)
    }

    const progressDisplay = activity.type === 'quit' 
      ? `${timeData.progressPercent.toFixed(1)}% of ${timeData.currentGoal}`
      : 'N/A'

    return `
      <tr data-activity-id="${activity.id}">
        <td>
          <div class="table-activity-name">
            ${activity.name}
            <span class="table-activity-type ${activity.type}">${activity.type}</span>
          </div>
        </td>
        <td class="table-progress">${progressDisplay}</td>
        <td class="table-time">${timeData.timeString}</td>
        <td class="table-actions">
          <button class="table-action-btn view-btn" data-activity-id="${activity.id}" title="View Details">👁</button>
          <button class="table-action-btn edit-btn" data-activity-id="${activity.id}" title="Edit">✏️</button>
          ${activity.type === 'quit' 
            ? `<button class="table-action-btn log-btn" data-activity-id="${activity.id}" title="Slipped Up">${activity.icon || '⚠️'}</button>`
            : `<button class="table-action-btn log-btn" data-activity-id="${activity.id}" title="Log Activity">✅</button>`
          }
        </td>
      </tr>
    `
  }

  addActivityTableListeners(container) {
    // View button listeners
    container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const activityId = btn.dataset.activityId
        this.showActivityDetails(activityId)
      })
    })

    // Edit button listeners
    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const activityId = btn.dataset.activityId
        const activity = this.activities.find(a => a.id === activityId)
        this.showActivityModal(activity)
      })
    })

    // Log button listeners
    container.querySelectorAll('.log-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const activityId = btn.dataset.activityId
        this.handleQuickLog(activityId)
      })
    })
  }

  addActivityCardContainerListeners(container) {
    // Card click listeners for showing details
    container.querySelectorAll('.activity-card.clickable').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons or interactive elements
        if (e.target.closest('button') || e.target.closest('.menu-dropdown')) {
          return
        }
        const activityId = card.dataset.activityId
        this.showActivityDetails(activityId)
      })
    })

    // Menu trigger listeners
    container.querySelectorAll('.menu-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        this.toggleActivityMenu(activityId)
      })
    })

    // Log button listeners (slipped up buttons)
    container.querySelectorAll('.slipped-up-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        this.handleQuickLog(activityId)
      })
    })

    // Habit log button listeners
    container.querySelectorAll('.log-btn.habit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        this.handleQuickLog(activityId)
      })
    })

    // Edit button listeners (in menu)
    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        const activity = this.activities.find(a => a.id === activityId)
        this.showActivityModal(activity)
        this.hideActivityMenu(activityId)
      })
    })

    // Delete button listeners (in menu)
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        this.handleDeleteActivity(activityId)
        this.hideActivityMenu(activityId)
      })
    })

    // Progress circle click handlers removed - goal setting only in calendar view

    // Goal option click handlers removed - goal setting only in calendar view

    // Close dropdown handlers
    container.querySelectorAll('.close-dropdown').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        this.hideGoalDropdown(activityId)
      })
    })

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.activity-menu')) {
        document.querySelectorAll('.menu-dropdown').forEach(menu => {
          menu.style.display = 'none'
        })
      }
    })

    // Close dropdown listeners removed - goal setting only in calendar view

    // Add drag and drop functionality
    this.setupDragAndDrop(container)
  }

  setupDragAndDrop(container) {
    const cards = container.querySelectorAll('.activity-card')
    
    cards.forEach(card => {
      card.draggable = true
      
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging')
        container.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/html', card.dataset.activityId)
      })
      
      card.addEventListener('dragend', (e) => {
        card.classList.remove('dragging')
        container.classList.remove('dragging')
        container.querySelectorAll('.activity-card').forEach(c => c.classList.remove('drag-over'))
      })
      
      card.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      })
      
      card.addEventListener('dragenter', (e) => {
        e.preventDefault()
        if (!card.classList.contains('dragging')) {
          card.classList.add('drag-over')
        }
      })
      
      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove('drag-over')
        }
      })
      
      card.addEventListener('drop', (e) => {
        e.preventDefault()
        const draggedId = e.dataTransfer.getData('text/html')
        const draggedCard = container.querySelector(`[data-activity-id="${draggedId}"]`)
        
        if (draggedCard && draggedCard !== card) {
          this.reorderCards(container, draggedCard, card)
        }
        
        card.classList.remove('drag-over')
      })
    })
  }

  reorderCards(container, draggedCard, targetCard) {
    // Get current order
    const cards = Array.from(container.querySelectorAll('.activity-card'))
    const draggedIndex = cards.indexOf(draggedCard)
    const targetIndex = cards.indexOf(targetCard)
    
    // Reorder DOM elements
    if (draggedIndex < targetIndex) {
      targetCard.parentNode.insertBefore(draggedCard, targetCard.nextSibling)
    } else {
      targetCard.parentNode.insertBefore(draggedCard, targetCard)
    }
    
    // Save new order to localStorage
    this.saveCardOrder(container)
  }

  saveCardOrder(container) {
    const tabType = container.id.replace('-grid', '') // habits-grid -> habits
    const cardIds = Array.from(container.querySelectorAll('.activity-card'))
      .map(card => card.dataset.activityId)
    
    const savedOrders = JSON.parse(localStorage.getItem('activityOrder') || '{}')
    savedOrders[tabType] = cardIds
    localStorage.setItem('activityOrder', JSON.stringify(savedOrders))
  }

  applySavedOrder(type, activities) {
    const savedOrders = JSON.parse(localStorage.getItem('activityOrder') || '{}')
    const savedOrder = savedOrders[type]
    
    if (!savedOrder) return activities
    
    // Sort activities based on saved order
    const orderedActivities = []
    const remainingActivities = [...activities]
    
    // Add activities in saved order
    savedOrder.forEach(id => {
      const index = remainingActivities.findIndex(a => a.id === id)
      if (index !== -1) {
        orderedActivities.push(remainingActivities.splice(index, 1)[0])
      }
    })
    
    // Add any new activities that weren't in the saved order
    orderedActivities.push(...remainingActivities)
    
    return orderedActivities
  }

  toggleGoalDropdown(activityId) {
    const dropdown = document.getElementById(`goal-dropdown-${activityId}`)
    if (dropdown) {
      const isVisible = dropdown.style.display !== 'none'
      
      // Hide all other dropdowns first
      document.querySelectorAll('.goal-dropdown').forEach(d => {
        d.style.display = 'none'
        // Move back to original position
        const originalParent = document.querySelector(`[data-activity-id="${d.id.replace('goal-dropdown-', '')}"]`)
        if (originalParent && d.parentNode === document.body) {
          originalParent.appendChild(d)
        }
      })
      
      if (isVisible) {
        dropdown.style.display = 'none'
      } else {
        // Move dropdown to body to escape stacking context
        const progressContainer = dropdown.closest('.progress-circle-container')
        const rect = progressContainer.getBoundingClientRect()
        
        document.body.appendChild(dropdown)
        dropdown.style.position = 'fixed'
        dropdown.style.display = 'block'
        dropdown.style.zIndex = '99999'
        
        // Position dropdown - show first to get accurate width
        dropdown.style.visibility = 'hidden'
        dropdown.style.display = 'block'
        const dropdownRect = dropdown.getBoundingClientRect()
        dropdown.style.visibility = 'visible'
        
        // Calculate position to align right edge of dropdown with right edge of progress circle
        const leftPos = rect.right - dropdownRect.width
        const topPos = rect.bottom + 5
        
        // Ensure dropdown stays within viewport
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        dropdown.style.left = `${Math.max(10, Math.min(leftPos, viewportWidth - dropdownRect.width - 10))}px`
        dropdown.style.top = `${Math.max(10, Math.min(topPos, viewportHeight - dropdownRect.height - 10))}px`
      }
    }
  }

  hideGoalDropdown(activityId) {
    const dropdown = document.getElementById(`goal-dropdown-${activityId}`)
    if (dropdown) {
      dropdown.style.display = 'none'
      // Move back to original position if it was moved to body
      const originalParent = document.querySelector(`[data-activity-id="${activityId}"]`)
      if (originalParent && dropdown.parentNode === document.body) {
        originalParent.appendChild(dropdown)
        dropdown.style.position = 'absolute'
      }
    }
  }

  addCalendarGoalListeners(container) {
    // Progress circle/goal text click handlers
    container.querySelectorAll('.clickable-progress, .clickable-goal').forEach(element => {
      element.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = element.closest('.progress-circle-container').dataset.activityId
        this.toggleCalendarGoalDropdown(activityId)
      })
    })

    // Goal option click handlers
    container.querySelectorAll('.goal-option').forEach(option => {
      option.addEventListener('click', () => {
        const goal = option.dataset.goal
        const hours = parseInt(option.dataset.hours)
        const activityId = option.closest('.progress-circle-container').dataset.activityId
        this.selectGoal(activityId, goal, hours)
      })
    })

    // Close dropdown button listeners
    container.querySelectorAll('.close-dropdown').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        this.hideCalendarGoalDropdown(activityId)
      })
    })

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.calendar-goal-dropdown') && !e.target.closest('.clickable-progress') && !e.target.closest('.clickable-goal')) {
        document.querySelectorAll('.calendar-goal-dropdown').forEach(dropdown => {
          dropdown.style.display = 'none'
        })
      }
    })
  }

  toggleCalendarGoalDropdown(activityId) {
    const dropdown = document.getElementById(`goal-dropdown-${activityId}`)
    if (dropdown) {
      const isVisible = dropdown.style.display !== 'none'
      
      // Hide all other dropdowns first
      document.querySelectorAll('.calendar-goal-dropdown').forEach(d => {
        d.style.display = 'none'
      })
      
      // Toggle this dropdown
      dropdown.style.display = isVisible ? 'none' : 'block'
    }
  }

  hideCalendarGoalDropdown(activityId) {
    const dropdown = document.getElementById(`goal-dropdown-${activityId}`)
    if (dropdown) {
      dropdown.style.display = 'none'
    }
  }

  switchView(viewType) {
    // Update current view
    this.currentView = viewType
    
    // Update button states
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewType)
    })
    
    // Save view preference
    localStorage.setItem('preferredView', viewType)
    
    // Re-render all activity tabs with new view (habits and quits)
    this.renderActivitiesInTab('habits')
    this.renderActivitiesInTab('quits')
  }

  toggleActivityMenu(activityId) {
    // Close all other menus first
    document.querySelectorAll('.menu-dropdown').forEach(menu => {
      if (menu.id !== `menu-${activityId}`) {
        menu.style.display = 'none'
      }
    })

    // Toggle the clicked menu
    const menu = document.getElementById(`menu-${activityId}`)
    if (menu) {
      const isVisible = menu.style.display !== 'none'
      menu.style.display = isVisible ? 'none' : 'block'
    }
  }

  hideActivityMenu(activityId) {
    const menu = document.getElementById(`menu-${activityId}`)
    if (menu) {
      menu.style.display = 'none'
    }
  }

  async selectGoal(activityId, goalName, goalHours) {
    try {
      // Find the activity and update its selected goal
      const activity = this.activities.find(a => a.id === activityId)
      if (!activity) {
        console.error('Activity not found:', activityId)
        return
      }

      console.log('Updating goal for activity:', activityId, goalName, goalHours)

      // Save to database first
      await api.updateActivityGoal(activityId, goalName, goalHours)

      // Store the selected goal locally
      activity.selectedGoal = { name: goalName, hours: goalHours }

      // Recalculate time data with new goal
      const timeData = this.calculateTimeDisplayWithGoal(activity, activity.lastEvent, goalHours, goalName)
      
      // Update the display
      const card = document.querySelector(`[data-activity-id="${activityId}"]`).closest('.activity-card')
      if (card) {
        const progressPercent = card.querySelector('.progress-percent')
        const progressGoal = card.querySelector('.progress-goal')
        const progressCircle = card.querySelector('circle[stroke-dasharray]')
        
        if (progressPercent) progressPercent.textContent = `${timeData.progressPercent.toFixed(1)}%`
        if (progressGoal) progressGoal.textContent = timeData.currentGoal
        if (progressCircle) {
          const circumference = 2 * Math.PI * 50
          progressCircle.style.strokeDashoffset = circumference * (1 - timeData.progressPercent / 100)
        }
      }

      // Hide the dropdown
      this.hideGoalDropdown(activityId)
      
      this.showMessage('Goal updated successfully!', 'success')
    } catch (error) {
      console.error('Error updating goal:', error)
      console.error('Error details:', error.message, error.stack)
      this.showMessage(`Failed to update goal: ${error.message}`, 'error')
    }
  }

  calculateTimeDisplayWithGoal(activity, lastEvent, goalHours, goalName) {
    const baseTimeData = this.calculateTimeDisplay(activity, lastEvent)
    
    // Override with selected goal
    const progressPercent = Math.min((baseTimeData.totalHours / goalHours) * 100, 100)
    
    return {
      ...baseTimeData,
      progressPercent,
      currentGoal: goalName
    }
  }

  renderActivityCard(activity) {
    const lastEvent = activity.lastEvent
    const stats = activity.statistics || {}
    
    // Calculate time since last event for quits
    let timeData
    if (activity.type === 'quit' && activity.selectedGoal) {
      timeData = this.calculateTimeDisplayWithGoal(activity, lastEvent, activity.selectedGoal.hours, activity.selectedGoal.name)
    } else {
      timeData = this.calculateTimeDisplay(activity, lastEvent)
    }
    
    return `
      <div class="activity-card clickable" style="border-color: ${activity.color}20" data-activity-id="${activity.id}">
        <div class="activity-header">
          <div class="activity-info">
            <div class="activity-name">
              ${activity.name}
              <span class="activity-type ${activity.type}">${activity.type}</span>
            </div>
          </div>
          <div class="activity-menu">
            <button class="menu-trigger" data-activity-id="${activity.id}">⋯</button>
            <div class="menu-dropdown" id="menu-${activity.id}" style="display: none;">
              <button class="menu-item edit-btn" data-activity-id="${activity.id}">
                ✏️ Edit
              </button>
              <button class="menu-item delete-btn" data-activity-id="${activity.id}">
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
        
        ${activity.type === 'quit' ? this.renderQuitDisplay(timeData, activity.color, activity.id, activity.icon) : this.renderHabitDisplay(stats)}

        ${activity.type === 'habit' ? `
          <div class="habit-actions">
            <button class="btn log-btn habit" data-activity-id="${activity.id}">
              ✓ Did it!
            </button>
          </div>
        ` : ''}
      </div>
    `
  }

  calculateTimeDisplay(activity, lastEvent) {
    let startDate
    
    if (activity.type === 'quit') {
      if (!lastEvent) {
        // No events logged yet - count from when activity was created
        // Ensure proper timezone handling by creating the date in local timezone
        startDate = new Date(activity.created_at)
        // If the timestamp doesn't include timezone info, it might be interpreted as UTC
        // Let's check if we need to adjust for timezone
        if (activity.created_at && !activity.created_at.includes('Z') && !activity.created_at.includes('+')) {
          // Assume it's UTC and convert to local time
          startDate = new Date(activity.created_at + 'Z')
        }
      } else {
        // Count from the last time they slipped up
        startDate = new Date(lastEvent.timestamp)
        // Same timezone handling for events
        if (lastEvent.timestamp && !lastEvent.timestamp.includes('Z') && !lastEvent.timestamp.includes('+')) {
          startDate = new Date(lastEvent.timestamp + 'Z')
        }
      }
    } else {
      // For habits, we don't use this time calculation
      return {
        timeString: 'N/A',
        progressPercent: 0,
        currentGoal: 'N/A',
        hasProgress: false
      }
    }

    const now = new Date()
    const diffMs = now - startDate
    
    // Convert to different units
    const totalSeconds = Math.floor(diffMs / 1000)
    const totalMinutes = Math.floor(totalSeconds / 60)
    const totalHours = Math.floor(totalMinutes / 60)
    const totalDays = Math.floor(totalHours / 24)
    
    const days = totalDays
    const hours = totalHours % 24
    const minutes = totalMinutes % 60
    const seconds = totalSeconds % 60

    // Format time string
    let timeString = ''
    if (days > 0) {
      timeString = `${days}d ${hours}h ${minutes}m ${seconds}s`
    } else if (hours > 0) {
      timeString = `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      timeString = `${minutes}m ${seconds}s`
    } else {
      timeString = `${seconds}s`
    }

    // Define milestone goals (in hours)
    const goals = [
      { name: '24 Hours', hours: 24 },
      { name: '3 Days', hours: 72 },
      { name: '1 Week', hours: 168 },
      { name: '10 Days', hours: 240 },
      { name: '2 Weeks', hours: 336 },
      { name: '1 Month', hours: 720 },
      { name: '3 Months', hours: 2160 },
      { name: '6 Months', hours: 4320 },
      { name: '1 Year', hours: 8760 },
      { name: '5 Years', hours: 43800 }
    ]

    // Find current goal
    let currentGoal = goals[goals.length - 1] // Default to highest goal
    let progressPercent = 100

    for (const goal of goals) {
      if (totalHours < goal.hours) {
        currentGoal = goal
        progressPercent = (totalHours / goal.hours) * 100
        break
      }
    }

    return {
      timeString,
      progressPercent: Math.min(progressPercent, 100),
      currentGoal: currentGoal.name,
      hasProgress: totalHours > 0,
      totalHours,
      days,
      hours,
      minutes,
      seconds
    }
  }

  renderQuitDisplay(timeData, color, activityId, icon) {
    const progressColor = color || '#ef4444'
    const buttonIcon = icon || '⚠️'
    
    return `
      <div class="quit-display-modern">
        <div class="quit-content">
          <div class="quit-left">
            <div class="abstinence-label">Abstinence Time</div>
            <div class="time-display-large">${timeData.timeString}</div>
            <div class="slipped-up-container">
              <button class="btn slipped-up-btn" data-activity-id="${activityId}">
                ${buttonIcon} Slipped up
              </button>
            </div>
          </div>
          
          <div class="quit-right">
            <div class="progress-circle-container" data-activity-id="${activityId}">
              <div class="progress-circle">
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="6"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="${progressColor}" stroke-width="6"
                    stroke-dasharray="${2 * Math.PI * 40}" 
                    stroke-dashoffset="${2 * Math.PI * 40 * (1 - timeData.progressPercent / 100)}"
                    stroke-linecap="round" transform="rotate(-90 50 50)"/>
                </svg>
                <div class="progress-content">
                  <div class="progress-percent">${timeData.progressPercent.toFixed(1)}%</div>
                  <div class="progress-goal">${timeData.currentGoal}</div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderGoalOptions(totalHours) {
    const goals = [
      { name: '24 Hours', hours: 24 },
      { name: '3 Days', hours: 72 },
      { name: '1 Week', hours: 168 },
      { name: '10 Days', hours: 240 },
      { name: '2 Weeks', hours: 336 },
      { name: '1 Month', hours: 720 },
      { name: '3 Months', hours: 2160 },
      { name: '6 Months', hours: 4320 },
      { name: '1 Year', hours: 8760 },
      { name: '5 Years', hours: 43800 }
    ]

    return goals.map(goal => {
      const isCompleted = totalHours >= goal.hours
      const progressPercent = isCompleted ? 100 : (totalHours / goal.hours) * 100
      
      return `
        <div class="goal-option ${isCompleted ? 'completed' : ''}" data-goal="${goal.name}" data-hours="${goal.hours}">
          <div class="goal-info">
            <span class="goal-name">${goal.name}</span>
            <span class="goal-progress">${progressPercent.toFixed(1)}%</span>
          </div>
          ${isCompleted ? '<span class="goal-check">✓</span>' : ''}
        </div>
      `
    }).join('')
  }

  renderHabitDisplay(stats) {
    return `
      <div class="habit-display">
        <div class="habit-stats">
          <div class="stat-item">
            <span>Current streak:</span>
            <span class="stat-value">${stats.currentStreak || 0} days</span>
          </div>
          <div class="stat-item">
            <span>Best streak:</span>
            <span class="stat-value">${stats.longestStreak || 0} days</span>
          </div>
          <div class="stat-item">
            <span>Total events:</span>
            <span class="stat-value">${stats.totalEvents || 0}</span>
          </div>
        </div>
      </div>
    `
  }

  renderTodayEvents() {
    const container = document.getElementById('today-events')
    
    if (this.todayEvents.length === 0) {
      container.innerHTML = '<p style="color: #666;">No events logged today yet.</p>'
      return
    }

    container.innerHTML = this.todayEvents.map(event => `
      <div class="today-event">
        ${event.activity.icon ? `<span>${event.activity.icon}</span>` : ''}
        <span>${event.activity.name}</span>
        <span style="color: #999;">• ${new Date(event.timestamp).toLocaleTimeString()}</span>
      </div>
    `).join('')
  }

  // Utility methods
  formatRelativeTime(date) {
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  showMessage(message, type = 'info') {
    const container = document.getElementById('message-container')
    const messageEl = document.createElement('div')
    messageEl.className = `message ${type}`
    messageEl.textContent = message

    container.appendChild(messageEl)

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl)
      }
    }, 5000)

    // Allow manual removal
    messageEl.addEventListener('click', () => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl)
      }
    })
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none'
  }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.habitTracker = new HabitTracker()
})