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
      // Apply saved theme immediately for instant loading
      const savedTheme = localStorage.getItem('selectedTheme') || 'light'
      this.applyTheme(savedTheme)

      // Check authentication status
      const authStatus = await api.checkAuthStatus()

      if (authStatus.authenticated) {
        // Load user preferences first
        const userResponse = await api.getCurrentUser()
        if (userResponse && userResponse.user) {
          this.userDefaultAbstinenceText = userResponse.user.default_abstinence_text || 'Abstinence time'
        }

        await this.loadUserData()
        this.showMainApp()
      } else {
        this.showAuthForms()
        // Check if signup is disabled
        await this.checkSignupStatus()
      }
    } catch (error) {
      console.error('Initialization error:', error)
      this.showAuthForms()
      // Check signup status even on error
      await this.checkSignupStatus()
    } finally {
      this.hideLoading()
    }

    this.setupEventListeners()
    
    // Initialize view state
    this.currentView = 'cards'
  }

  async checkSignupStatus() {
    try {
      const response = await api.getSignupStatus()
      const registerLink = document.getElementById('show-register')

      if (response && response.signupDisabled) {
        // Hide registration option if signup is disabled
        if (registerLink && registerLink.parentElement) {
          registerLink.parentElement.style.display = 'none'
        }
      } else {
        // Show registration option if signup is enabled
        if (registerLink && registerLink.parentElement) {
          registerLink.parentElement.style.display = 'block'
        }
      }
    } catch (error) {
      console.error('Error checking signup status:', error)
      // Default to showing registration on error
    }
  }

  async loadUserData() {
    try {
      // Load current user
      const userResponse = await api.getCurrentUser()
      this.currentUser = userResponse.user
      this.applyCardDensity()

      // Load activities with stats and last event
      const activitiesResponse = await api.getActivities({
        includeStats: true,
        includeLastEvent: true,
        includeWeekly: true
      })
      this.activities = activitiesResponse.activities.map(activity => ({
        ...activity,
        allow_multiple_entries_per_day: Boolean(activity.allow_multiple_entries_per_day)
      }))

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

      // Update UI based on user preferences
      this.updateTabVisibility()
      this.updateAppTitle()
      this.updateTitleSectionVisibility()

      // Load custom themes and apply selected theme
      await this.loadCustomThemes()
      this.applyTheme(this.currentUser?.selected_theme || 'light')

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

    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.showSettingsModal()
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

    // Activity type change listener
    document.getElementById('activity-type')?.addEventListener('change', (e) => {
      const abstinenceGroup = document.getElementById('abstinence-text-group')
      const abstinenceInput = document.getElementById('activity-abstinence-text')
      const editBtn = document.getElementById('edit-abstinence-text')
      const habitMultiGroup = document.getElementById('habit-multi-group')
      const habitMultiCheckbox = document.getElementById('habit-allow-multiple')

      if (!abstinenceGroup) return

      if (e.target.value === 'quit') {
        abstinenceGroup.style.display = 'block'
        abstinenceInput.value = ''
        abstinenceInput.placeholder = this.userDefaultAbstinenceText || 'Abstinence time'
        abstinenceInput.disabled = true
        editBtn.classList.remove('active')
        if (habitMultiGroup) habitMultiGroup.style.display = 'none'
        if (habitMultiCheckbox) habitMultiCheckbox.checked = false
      } else {
        abstinenceGroup.style.display = 'none'
        if (habitMultiGroup) habitMultiGroup.style.display = 'block'
      }
    })

    // Abstinence text edit button
    document.getElementById('edit-abstinence-text')?.addEventListener('click', (e) => {
      e.preventDefault()
      const input = document.getElementById('activity-abstinence-text')
      const btn = e.target

      if (input.disabled) {
        // Enable editing
        input.disabled = false
        input.focus()
        btn.classList.add('active')
        if (!input.value) {
          input.placeholder = 'e.g., Clean for, Smoke-free for'
        }
      } else {
        // Disable editing
        input.disabled = true
        btn.classList.remove('active')
        if (!input.value) {
          input.placeholder = 'Abstinence time'
        }
      }
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
        // Check if mobile viewport
        const isMobile = window.innerWidth <= 768
        
        if (isMobile) {
          // On mobile, cycle through views
          this.cycleView()
        } else {
          // On desktop, switch to specific view
          const targetView = e.currentTarget.dataset.view
          this.switchView(targetView)
        }
      })
    })

    // Add Activity buttons in empty states
    document.querySelector('.add-habit-btn')?.addEventListener('click', () => {
      this.showActivityModal(null, 'habit')
    })

    document.querySelector('.add-quit-btn')?.addEventListener('click', () => {
      this.showActivityModal(null, 'quit')
    })

    // Retroactive slip-up modal events
    document.getElementById('close-slipup-modal')?.addEventListener('click', () => {
      this.hideRetroactiveSlipupModal()
    })

    document.getElementById('cancel-slipup-modal')?.addEventListener('click', () => {
      this.hideRetroactiveSlipupModal()
    })

    document.getElementById('slipup-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'slipup-modal') {
        this.hideRetroactiveSlipupModal()
      }
    })

    document.getElementById('slipup-form')?.addEventListener('submit', (e) => {
      console.log('🔍 DEBUG: Form submit event triggered')
      e.preventDefault()
      this.handleRetroactiveSlipupSubmit(e.target)
    })

    // Day entries modal events
    document.getElementById('close-day-entries')?.addEventListener('click', () => {
      this.hideDayEntriesModal()
    })

    document.getElementById('day-entries-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'day-entries-modal') {
        this.hideDayEntriesModal()
      }
    })

    document.getElementById('add-new-entry-btn')?.addEventListener('click', async () => {
      const modal = document.getElementById('day-entries-modal')
      if (!modal) return
      const date = modal.dataset.currentDate
      const activityId = modal.dataset.activityId
      const activity = this.activities.find(a => a.id === activityId)

      if (!activity) return

      if (activity.type === 'quit') {
        this.hideDayEntriesModal()
        this.showRetroactiveSlipupModal(activityId, date)
        return
      }

      // Habit: add entry for this date respecting multi/single
      try {
        if (activity.allow_multiple_entries_per_day) {
          await this.handleHabitDayAdjust(activityId, date, +1, null)
        } else {
          await this.handleHabitDayToggle(activityId, date, true, null)
        }
      } finally {
        // After add, refresh calendar and reopen modal for the same date
        const currentDate = new Date()
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

        const eventsResponse = await api.getEventsInDateRange(
          activityId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        )

        const tabContent = document.querySelector('.fullscreen-calendar-view')
        if (tabContent) {
          this.updateFullScreenCalendar(tabContent, currentDate, eventsResponse.events || [])
        }

        const dateString = new Date(date + 'T00:00:00').toDateString()
        this.showDayEntriesModal(activityId, date, dateString)
      }
    })

    // Settings modal events
    document.getElementById('close-settings')?.addEventListener('click', () => {
      this.hideSettingsModal()
    })

    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') {
        this.hideSettingsModal()
      }
    })

    // Theme creator events
    document.getElementById('create-theme-btn')?.addEventListener('click', () => {
      this.showThemeCreator()
    })

    document.getElementById('theme-creator-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'theme-creator-modal') {
        this.hideThemeCreator()
      }
    })

    document.getElementById('preview-theme-btn')?.addEventListener('click', () => {
      this.previewCustomTheme()
    })

    document.getElementById('save-theme-btn')?.addEventListener('click', () => {
      this.saveCustomTheme()
    })

    // Sync color pickers with text inputs
    this.setupColorInputSync()

    // Save default abstinence text
    document.getElementById('save-abstinence-text')?.addEventListener('click', async () => {
      const input = document.getElementById('default-abstinence-text')
      const value = input.value.trim() || 'Abstinence time'

      try {
        await api.updatePreferences({ defaultAbstinenceText: value })
        this.userDefaultAbstinenceText = value
        this.showMessage('Default text saved successfully', 'success')

        // Reload activities to show the new default text
        await this.loadUserData()
      } catch (error) {
        console.error('Error saving default abstinence text:', error)
        this.showMessage('Failed to save default text', 'error')
      }
    })

    // Restore default abstinence text
    document.getElementById('restore-abstinence-default')?.addEventListener('click', async () => {
      try {
        const response = await api.restoreDefaultPreferences()
        const defaultText = response.preferences.default_abstinence_text

        // Update the input field
        const input = document.getElementById('default-abstinence-text')
        if (input) {
          input.value = defaultText
        }

        this.userDefaultAbstinenceText = defaultText
        this.showMessage('Restored to system default: "' + defaultText + '"', 'success')

        // Reload activities to show the restored default text
        await this.loadUserData()
      } catch (error) {
        console.error('Error restoring default abstinence text:', error)
        this.showMessage('Failed to restore default text', 'error')
      }
    })

    // Tab visibility settings
    const habitsCheckbox = document.getElementById('show-habits-tab')
    const quitsCheckbox = document.getElementById('show-quits-tab')
    const logsCheckbox = document.getElementById('show-logs-tab')
    const tabVisibilityError = document.getElementById('tab-visibility-error')

    const updateTabVisibilitySettings = async () => {
      const showHabits = habitsCheckbox?.checked
      const showQuits = quitsCheckbox?.checked
      const showLogs = logsCheckbox?.checked

      // Validate that at least one main tab is visible
      if (!showHabits && !showQuits) {
        tabVisibilityError.style.display = 'block'
        // Revert the change
        if (this.currentUser?.show_habits_tab) {
          habitsCheckbox.checked = true
        } else {
          quitsCheckbox.checked = true
        }
        return
      }

      tabVisibilityError.style.display = 'none'

      try {
        await api.updatePreferences({
          showHabitsTab: showHabits,
          showQuitsTab: showQuits,
          showLogsTab: showLogs
        })

        // Update local user object
        this.currentUser.show_habits_tab = showHabits
        this.currentUser.show_quits_tab = showQuits
        this.currentUser.show_logs_tab = showLogs

        // Update UI
        this.updateTabVisibility()

        // If current tab is now hidden, switch to first visible tab
        const currentTab = document.querySelector('.tab-button.active')?.dataset.tab
        if ((currentTab === 'habits' && !showHabits) ||
            (currentTab === 'quits' && !showQuits) ||
            (currentTab === 'logs' && !showLogs)) {
          if (showHabits) {
            this.switchTab('habits')
          } else if (showQuits) {
            this.switchTab('quits')
          } else if (showLogs) {
            this.switchTab('logs')
          }
        }

        this.showMessage('Tab visibility updated', 'success')
      } catch (error) {
        console.error('Error updating tab visibility:', error)
        this.showMessage('Failed to update tab visibility', 'error')
        // Revert checkboxes on error
        habitsCheckbox.checked = this.currentUser?.show_habits_tab
        quitsCheckbox.checked = this.currentUser?.show_quits_tab
        logsCheckbox.checked = this.currentUser?.show_logs_tab
      }
    }

    habitsCheckbox?.addEventListener('change', updateTabVisibilitySettings)
    quitsCheckbox?.addEventListener('change', updateTabVisibilitySettings)
    logsCheckbox?.addEventListener('change', updateTabVisibilitySettings)

    // Custom title settings
    document.getElementById('save-custom-title')?.addEventListener('click', async () => {
      const input = document.getElementById('custom-title')
      const value = input.value.trim() || 'Habit Tracker'

      try {
        await api.updatePreferences({ customTitle: value })
        this.currentUser.custom_title = value
        this.updateAppTitle()
        this.showMessage('Title updated successfully', 'success')
      } catch (error) {
        console.error('Error saving custom title:', error)
        this.showMessage('Failed to save title', 'error')
      }
    })

    // Restore default title
    document.getElementById('restore-title-default')?.addEventListener('click', async () => {
      try {
        const response = await api.restoreDefaultPreferences()
        const defaultTitle = response.preferences.custom_title

        // Update the input field
        const input = document.getElementById('custom-title')
        if (input) {
          input.value = defaultTitle
        }

        this.currentUser.custom_title = defaultTitle
        this.updateAppTitle()
        this.showMessage('Title restored to default: "' + defaultTitle + '"', 'success')
      } catch (error) {
        console.error('Error restoring default title:', error)
        this.showMessage('Failed to restore default title', 'error')
      }
    })

    // Title section visibility
    document.getElementById('show-title-section')?.addEventListener('change', async (e) => {
      const showTitle = e.target.checked

      try {
        await api.updatePreferences({ showTitleSection: showTitle })
        this.currentUser.show_title_section = showTitle
        this.updateTitleSectionVisibility()
        this.showMessage(showTitle ? 'Title section shown' : 'Title section hidden', 'success')
      } catch (error) {
        console.error('Error updating title visibility:', error)
        this.showMessage('Failed to update title visibility', 'error')
        // Revert on error
        e.target.checked = this.currentUser?.show_title_section !== false
      }
    })

    document.querySelectorAll('input[name="card-density"]').forEach(radio => {
      radio.addEventListener('change', async (e) => {
        if (!e.target.checked) return

        const selectedDensity = e.target.value
        if (!['comfy', 'compact'].includes(selectedDensity)) {
          return
        }

        if (this.currentUser?.card_density === selectedDensity) {
          return
        }

        try {
          await api.updatePreferences({ cardDensity: selectedDensity })
          this.currentUser.card_density = selectedDensity
          this.applyCardDensity()
          this.renderActivitiesInTab('habits')
          this.renderActivitiesInTab('quits')
          this.showMessage(selectedDensity === 'compact' ? 'Switched to compact cards' : 'Switched to comfy cards', 'success')
        } catch (error) {
          console.error('Error updating card density:', error)
          this.showMessage('Failed to update card density', 'error')

          // Revert selection to current setting
          const currentDensity = this.currentUser?.card_density || 'comfy'
          const currentRadio = document.querySelector(`input[name="card-density"][value="${currentDensity}"]`)
          if (currentRadio) currentRadio.checked = true
        }
      })
    })

    // Theme selector
    document.getElementById('theme-select')?.addEventListener('change', async (e) => {
      const selectedTheme = e.target.value

      if (selectedTheme === 'custom') {
        // Show custom theme editor (to be implemented)
        this.showMessage('Custom theme editor coming soon!', 'info')
        // Reset to current theme
        e.target.value = this.currentUser?.selected_theme || 'light'
        return
      }

      await this.switchTheme(selectedTheme)
    })

    // API key management
    document.getElementById('create-api-key-btn')?.addEventListener('click', () => {
      this.createApiKey()
    })

    document.getElementById('view-api-docs-btn')?.addEventListener('click', () => {
      this.showApiDocs()
    })

    document.getElementById('close-api-key-modal')?.addEventListener('click', () => {
      document.getElementById('api-key-modal').style.display = 'none'
    })

    document.getElementById('copy-api-key-btn')?.addEventListener('click', () => {
      const keyValue = document.getElementById('api-key-value').textContent
      navigator.clipboard.writeText(keyValue).then(() => {
        this.showMessage('API key copied to clipboard', 'success')
      })
    })

    document.getElementById('close-api-docs-modal')?.addEventListener('click', () => {
      document.getElementById('api-docs-modal').style.display = 'none'
    })

    document.getElementById('api-docs-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'api-docs-modal') {
        document.getElementById('api-docs-modal').style.display = 'none'
      }
    })

    // Admin settings - disable signup checkbox
    document.getElementById('disable-signup')?.addEventListener('change', async (e) => {
      const isDisabled = e.target.checked

      try {
        await api.updateSystemSetting('signup_disabled', isDisabled.toString())
        this.showMessage(`Signup ${isDisabled ? 'disabled' : 'enabled'} successfully`, 'success')
      } catch (error) {
        console.error('Error updating signup setting:', error)
        this.showMessage('Failed to update signup setting', 'error')
        // Revert checkbox on error
        e.target.checked = !isDisabled
      }
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
    let savedTab = localStorage.getItem('activeTab') || 'habits'

    // If the saved tab is hidden, switch to the first visible tab
    if ((savedTab === 'habits' && !this.currentUser?.show_habits_tab) ||
        (savedTab === 'quits' && !this.currentUser?.show_quits_tab) ||
        (savedTab === 'logs' && !this.currentUser?.show_logs_tab)) {
      // Find the first visible tab
      if (this.currentUser?.show_habits_tab) {
        savedTab = 'habits'
      } else if (this.currentUser?.show_quits_tab) {
        savedTab = 'quits'
      } else if (this.currentUser?.show_logs_tab) {
        savedTab = 'logs'
      }
    }

    this.switchTab(savedTab)
  }

  updateTabVisibility() {
    if (!this.currentUser) return

    // Update tab button visibility
    const habitsTab = document.querySelector('[data-tab="habits"]')
    const quitsTab = document.querySelector('[data-tab="quits"]')
    const logsTab = document.querySelector('[data-tab="logs"]')

    if (habitsTab) habitsTab.style.display = this.currentUser.show_habits_tab ? '' : 'none'
    if (quitsTab) quitsTab.style.display = this.currentUser.show_quits_tab ? '' : 'none'
    if (logsTab) logsTab.style.display = this.currentUser.show_logs_tab ? '' : 'none'

    // Update checkbox states in settings
    const habitsCheckbox = document.getElementById('show-habits-tab')
    const quitsCheckbox = document.getElementById('show-quits-tab')
    const logsCheckbox = document.getElementById('show-logs-tab')

    if (habitsCheckbox) habitsCheckbox.checked = this.currentUser.show_habits_tab
    if (quitsCheckbox) quitsCheckbox.checked = this.currentUser.show_quits_tab
    if (logsCheckbox) logsCheckbox.checked = this.currentUser.show_logs_tab
  }

  updateAppTitle() {
    if (!this.currentUser) return

    const title = this.currentUser.custom_title || 'Habit Tracker'

    // Update page title
    document.title = title

    // Update header title
    const headerTitle = document.querySelector('.header-content h1')
    if (headerTitle) {
      headerTitle.textContent = title
    }

    // Update auth page title
    const authTitle = document.querySelector('.auth-card h1')
    if (authTitle) {
      authTitle.textContent = title
    }
  }

  updateTitleSectionVisibility() {
    const headerContent = document.querySelector('.header-content')
    const headerMenu = document.querySelector('.header-menu')
    const viewToggle = document.querySelector('.view-toggle')
    const headerTabs = document.querySelector('.header-tabs')

    const showTitle = this.currentUser?.show_title_section !== false

    if (!headerMenu || !headerContent) return

    headerMenu.style.position = ''
    headerMenu.style.right = ''
    headerMenu.style.top = ''
    headerMenu.style.transform = ''

    const dropdown = headerMenu.querySelector('.header-dropdown')

    if (!showTitle) {
      document.body.classList.add('title-hidden')
      headerContent.style.display = 'none'

      if (dropdown) dropdown.style.display = 'none'

      const target = viewToggle || headerTabs
      if (target && headerMenu.parentElement !== target) {
        headerMenu.classList.add('header-menu-inline')
        target.appendChild(headerMenu)
      }
    } else {
      document.body.classList.remove('title-hidden')
      headerContent.style.display = ''

      if (headerMenu.parentElement !== headerContent) {
        headerMenu.classList.remove('header-menu-inline')
        headerContent.appendChild(headerMenu)
      }
    }
  }

  applyCardDensity() {
    const body = document.body
    body.classList.remove('card-density-comfy', 'card-density-compact')

    const density = this.currentUser?.card_density || 'comfy'
    body.classList.add(`card-density-${density}`)
  }

  // Theme methods
  async applyTheme(themeName) {
    if (!themeName) return

    // Check if it's a built-in theme
    const builtInThemes = ['light', 'dark', 'ocean']

    if (builtInThemes.includes(themeName)) {
      // Apply built-in theme
      document.documentElement.setAttribute('data-theme', themeName)
      // Clear any custom CSS variables
      const root = document.documentElement
      root.style.cssText = ''
    } else {
      // Apply custom theme
      try {
        const response = await api.getThemes()
        const customTheme = response.themes.find(t => t.name === themeName)

        if (customTheme && customTheme.colors) {
          // Remove data-theme attribute for custom themes
          document.documentElement.removeAttribute('data-theme')

          // Apply custom colors as CSS variables
          const root = document.documentElement
          const colors = JSON.parse(customTheme.colors)
          for (const [key, value] of Object.entries(colors)) {
            root.style.setProperty(`--${key}`, value)
          }
        }
      } catch (error) {
        console.error('Failed to load custom theme:', error)
        // Fall back to light theme
        document.documentElement.setAttribute('data-theme', 'light')
      }
    }

    // Store in localStorage for immediate access
    localStorage.setItem('selectedTheme', themeName)
    this.selectedTheme = themeName
  }

  async switchTheme(themeName) {
    try {
      // Apply theme locally first for instant feedback
      this.applyTheme(themeName)

      // Save to server
      await api.updatePreferences({ selectedTheme: themeName })

      // Update user object
      if (this.currentUser) {
        this.currentUser.selected_theme = themeName
      }

      this.showMessage(`Theme switched to ${themeName}`, 'success')
    } catch (error) {
      console.error('Error switching theme:', error)
      this.showMessage('Failed to switch theme', 'error')
    }
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
      this.applyCardDensity()
      document.body.classList.remove('title-hidden')
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
        
        ${activity.type === 'quit' ? this.renderProgressCircleWithGoalSelection(timeData, activity.color, activityId, activity.abstinence_text) : ''}
        
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
    
    // Add calendar day listeners for slip-up logging
    this.addCalendarDayListeners(tabContent)
  }

  updateFullScreenCalendar(container, date, events) {
    const monthSpan = container.querySelector('#current-month')
    const calendarContainer = container.querySelector('.calendar-container')
    
    monthSpan.textContent = `${this.getMonthName(date.getMonth())} ${date.getFullYear()}`
    
    const newCalendar = this.renderCalendar(date, events)
    const existingCalendar = calendarContainer.querySelector('.calendar-grid')
    existingCalendar.outerHTML = newCalendar
    
    // Re-add calendar day click listeners after updating calendar
    this.addCalendarDayListeners(container)
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
      
      ${activity.type === 'quit' ? this.renderQuitDisplay(timeData, activity.color, activity.id) : this.renderHabitDisplay(activity)}

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

  renderProgressCircle(timeData, color, abstinenceText) {
    const progressColor = color || '#ef4444'
    const displayText = abstinenceText || 'Abstinence time'
    
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
          <div class="abstinence-label">${displayText}</div>
          <div class="time-display">${timeData.timeString}</div>
        </div>
      </div>
    `
  }

  renderProgressCircleWithGoalSelection(timeData, color, activityId, abstinenceText) {
    const progressColor = color || '#ef4444'
    const displayText = abstinenceText || 'Abstinence time'
    
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
          <div class="abstinence-label">${displayText}</div>
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

    // Create event map that counts events per date
    const eventCounts = new Map()
    const eventsByDate = new Map()
    events.forEach(event => {
      const eventDate = new Date(event.timestamp).toDateString()
      const count = eventCounts.get(eventDate) || 0
      eventCounts.set(eventDate, count + 1)

      // Store events by date for later retrieval
      if (!eventsByDate.has(eventDate)) {
        eventsByDate.set(eventDate, [])
      }
      eventsByDate.get(eventDate).push(event)
    })

    // Store events map for later use
    this.currentMonthEvents = eventsByDate

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
      const eventCount = eventCounts.get(dateString) || 0
      const isToday = dateString === new Date().toDateString()

      // Generate tally dots
      let dotsHTML = ''
      if (eventCount > 0) {
        dotsHTML = '<div class="event-tally">'
        if (eventCount <= 5) {
          // Show red dots for 1-5 events
          for (let i = 0; i < eventCount; i++) {
            dotsHTML += '<span class="tally-dot red"></span>'
          }
        } else {
          // Show orange dot for 5+ events with count
          dotsHTML += `<span class="tally-dot orange" data-count="${eventCount}">${eventCount}</span>`
        }
        dotsHTML += '</div>'
      }

      calendarHTML += `
        <div class="calendar-day ${eventCount > 0 ? 'has-event' : ''} ${isToday ? 'today' : ''} clickable-day"
             data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}"
             data-date-string="${dateString}">
          <span class="day-number">${day}</span>
          ${dotsHTML}
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
    const abstinenceGroup = document.getElementById('abstinence-text-group')
    const abstinenceInput = document.getElementById('activity-abstinence-text')
    const editBtn = document.getElementById('edit-abstinence-text')
    const habitMultiGroup = document.getElementById('habit-multi-group')
    const habitMultiCheckbox = document.getElementById('habit-allow-multiple')

    if (activity) {
      title.textContent = 'Edit Activity'
      form.elements.name.value = activity.name
      form.elements.type.value = activity.type
      form.elements.icon.value = activity.icon || ''
      form.elements.color.value = activity.color || '#6366f1'
      form.dataset.activityId = activity.id

      if (activity.type === 'habit') {
        if (habitMultiGroup) habitMultiGroup.style.display = 'block'
        if (habitMultiCheckbox) {
          habitMultiCheckbox.checked = Boolean(activity.allow_multiple_entries_per_day)
        }
      } else {
        if (habitMultiGroup) habitMultiGroup.style.display = 'none'
        if (habitMultiCheckbox) habitMultiCheckbox.checked = false
      }

      // Show abstinence text field for quits
      if (activity.type === 'quit') {
        abstinenceGroup.style.display = 'block'
        if (!activity.use_default_abstinence_text && activity.abstinence_text) {
          // Using custom text
          abstinenceInput.value = activity.abstinence_text
          abstinenceInput.disabled = false
          editBtn.classList.add('active')
        } else {
          // Using default
          abstinenceInput.value = ''
          abstinenceInput.placeholder = this.userDefaultAbstinenceText || 'Abstinence time'
          abstinenceInput.disabled = true
          editBtn.classList.remove('active')
        }
      } else {
        abstinenceGroup.style.display = 'none'
      }
    } else {
      title.textContent = 'Add Activity'
      form.reset()
      form.elements.color.value = '#6366f1'
      if (presetType) {
        form.elements.type.value = presetType
        // Show abstinence field for new quits
        if (presetType === 'quit') {
          abstinenceGroup.style.display = 'block'
          abstinenceInput.value = ''
          abstinenceInput.placeholder = this.userDefaultAbstinenceText || 'Abstinence time'
          abstinenceInput.disabled = true
          editBtn.classList.remove('active')
          if (habitMultiGroup) habitMultiGroup.style.display = 'none'
          if (habitMultiCheckbox) habitMultiCheckbox.checked = false
        } else {
          abstinenceGroup.style.display = 'none'
          if (habitMultiGroup) habitMultiGroup.style.display = 'block'
          if (habitMultiCheckbox) habitMultiCheckbox.checked = false
        }
      } else {
        abstinenceGroup.style.display = 'none'
        if (habitMultiGroup) habitMultiGroup.style.display = 'none'
        if (habitMultiCheckbox) habitMultiCheckbox.checked = false
      }
      delete form.dataset.activityId
    }

    modal.style.display = 'flex'
  }

  hideActivityModal() {
    document.getElementById('activity-modal').style.display = 'none'
  }

  showRetroactiveSlipupModal(activityId, date) {
    const modal = document.getElementById('slipup-modal')
    const form = document.getElementById('slipup-form')
    const dateInput = document.getElementById('slipup-date')
    const timeInput = document.getElementById('slipup-time')
    const title = document.getElementById('slipup-modal-title')
    
    if (!modal || !form) return
    
    // Get activity name for modal title
    const activity = this.activities.find(a => a.id == activityId)
    if (activity) {
      title.textContent = `Log Slip-up - ${activity.name}`
    }
    
    // Set the date (readonly)
    dateInput.value = date
    
    // Set current time as default
    const now = new Date()
    timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    
    // Store activity ID on form
    form.dataset.activityId = activityId
    
    // Show modal
    modal.style.display = 'flex'
    timeInput.focus()
  }

  hideRetroactiveSlipupModal() {
    const modal = document.getElementById('slipup-modal')
    const form = document.getElementById('slipup-form')
    
    if (modal && form) {
      modal.style.display = 'none'
      form.reset()
      delete form.dataset.activityId
    }
  }

  async handleRetroactiveSlipupSubmit(form) {
    console.log('🔍 DEBUG: handleRetroactiveSlipupSubmit called')
    
    // Prevent multiple submissions
    if (this.isSubmittingSlipup) {
      console.log('🛑 DEBUG: Already submitting, preventing duplicate')
      return
    }
    this.isSubmittingSlipup = true
    
    try {
      const formData = new FormData(form)
      const activityId = form.dataset.activityId
      const date = formData.get('date')
      const time = formData.get('time')
      const notes = formData.get('notes') || ''
      
      console.log('📝 DEBUG: Form data:', { activityId, date, time, notes })
      
      // Create timestamp from date and time
      const datetime = new Date(`${date}T${time}:00`)
      const timestamp = datetime.toISOString()
      
      console.log('🚀 DEBUG: About to submit event with timestamp:', timestamp)
      
      // Log the slip-up event
      await api.createEvent({
        activity_id: activityId,
        type: 'slipup',
        timestamp: timestamp,
        note: notes  // Backend expects 'note' not 'notes'
      })
      
      console.log('✅ DEBUG: Event creation completed')

      this.hideRetroactiveSlipupModal()
      this.showMessage('Slip-up logged successfully', 'success')

      // If we're in calendar view, just refresh the calendar without calling loadUserData
      if (this.currentCalendarActivity == activityId) {
        // Get events for the current month being displayed
        const currentDate = new Date()
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

        const eventsResponse = await api.getEventsInDateRange(
          activityId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        )

        const tabContent = document.querySelector('.fullscreen-calendar-view')
        if (tabContent) {
          this.updateFullScreenCalendar(tabContent, currentDate, eventsResponse.events || [])
        }
      } else {
        // Only reload user data if we're not in calendar view
        await this.loadUserData()
      }

    } catch (error) {
      console.error('Error logging retroactive slip-up:', error)
      this.showMessage('Failed to log slip-up', 'error')
    } finally {
      // Always reset the submission flag
      this.isSubmittingSlipup = false
    }
  }

  async handleActivitySubmit(form) {
    try {
      const formData = new FormData(form)
      const activityData = {
        name: (formData.get('name') || '').trim(),
        type: formData.get('type'),
        icon: (formData.get('icon') || '').trim() || null,
        color: formData.get('color')
      }

      const allowMultiplePerDayValue = formData.get('allowMultiplePerDay')
      const allowMultiplePerDay = allowMultiplePerDayValue === 'on' || allowMultiplePerDayValue === 'true'
      if (activityData.type === 'habit') {
        activityData.allowMultiplePerDay = allowMultiplePerDay
      }

      // Include abstinence text for quits
      if (activityData.type === 'quit') {
        const abstinenceInput = document.getElementById('activity-abstinence-text')
        if (!abstinenceInput.disabled && abstinenceInput.value) {
          // User has customized it for this specific activity
          activityData.abstinenceText = abstinenceInput.value
        } else {
          // Using default - send empty to signal default usage
          activityData.abstinenceText = ''
        }
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
        const activity = this.activities[activityIndex]
        activity.lastEvent = {
          timestamp: response.event.timestamp,
          note: response.event.note
        }

        if (activity.type === 'habit') {
          try {
            const statsResponse = await api.getActivityStats(activityId)
            activity.statistics = statsResponse.statistics
          } catch (statsError) {
            console.error('Failed to refresh habit statistics:', statsError)
          }

          const eventDate = response.date
            ? response.date
            : response.event?.timestamp
              ? this.getLocalDateString(new Date(response.event.timestamp))
              : this.getLocalDateString(new Date())

          this.applyHabitDayStatus(activityId, eventDate, {
            completed: true,
            count: typeof response.day_count === 'number' ? response.day_count : undefined
          })
        }
      }
      
      this.showMessage(response.message || 'Event logged successfully!', 'success')
      
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

  async handleHabitDayToggle(activityId, date, shouldComplete, button) {
    if (button && button.dataset.loading === 'true') {
      return
    }

    if (button) {
      button.dataset.loading = 'true'
      button.setAttribute('disabled', 'disabled')
    }

    try {
      const response = await api.setHabitDayStatus(activityId, date, shouldComplete)

      this.applyHabitDayStatus(activityId, date, response)

      const activity = this.activities.find(a => a.id === activityId)
      if (activity) {
        activity.statistics = response.statistics
      }

      if (this.isToday(date)) {
        const eventsResponse = await api.getEvents({
          today: true,
          includeActivity: true
        })
        this.todayEvents = eventsResponse.events
        this.renderTodayEvents()
      }

      this.renderActivitiesInTab('habits')

      const message = response.message || (shouldComplete ? 'Marked day as complete' : 'Marked day as incomplete')
      this.showMessage(message, 'success')
    } catch (error) {
      console.error('Habit day toggle error:', error)
      this.showMessage(error.message || 'Failed to update habit day', 'error')
    } finally {
      if (button) {
        button.removeAttribute('disabled')
        delete button.dataset.loading
      }
    }
  }

  async handleHabitDayAdjust(activityId, date, delta, button) {
    if (delta === 0) {
      return
    }

    if (button && button.dataset.loading === 'true') {
      return
    }

    const currentCount = parseInt((button?.dataset.count) || '0', 10)
    if (button && delta < 0 && currentCount <= 0) {
      return
    }

    if (button) {
      button.dataset.loading = 'true'
      button.setAttribute('disabled', 'disabled')
    }

    try {
      const response = await api.adjustHabitDayCount(activityId, date, delta)

      this.applyHabitDayStatus(activityId, date, response)

      const activity = this.activities.find(a => a.id === activityId)
      if (activity) {
        activity.statistics = response.statistics
      }

      if (this.isToday(date)) {
        const eventsResponse = await api.getEvents({
          today: true,
          includeActivity: true
        })
        this.todayEvents = eventsResponse.events
        this.renderTodayEvents()
      }

      this.renderActivitiesInTab('habits')

      const message = response.message || (delta > 0 ? 'Added additional entry' : 'Removed an entry')
      this.showMessage(message, 'success')
    } catch (error) {
      console.error('Habit day adjust error:', error)
      this.showMessage(error.message || 'Failed to adjust habit day', 'error')
    } finally {
      if (button) {
        button.removeAttribute('disabled')
        delete button.dataset.loading
      }
    }
  }

  applyHabitDayStatus(activityId, date, statusPayload) {
    const activity = this.activities.find(a => a.id === activityId)
    if (!activity || !activity.weekly_log || !Array.isArray(activity.weekly_log.days)) {
      return
    }

    const dayEntry = activity.weekly_log.days.find(day => day.date === date)
    if (!dayEntry) {
      return
    }

    const newCount = typeof statusPayload.count === 'number'
      ? statusPayload.count
      : statusPayload.completed
        ? Math.max(typeof dayEntry.count === 'number' ? dayEntry.count : 0, 1)
        : 0

    dayEntry.count = newCount
    dayEntry.completed = newCount > 0
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
    // Skip rendering if we're not in the main app view (e.g., calendar view)
    const habitsCount = document.getElementById('habits-count')
    const quitsCount = document.getElementById('quits-count')
    const logsCount = document.getElementById('logs-count')
    
    if (!habitsCount || !quitsCount || !logsCount) {
      // We're probably in calendar view, skip main app rendering
      return
    }
    
    // Load view preference
    this.currentView = localStorage.getItem('preferredView') || 'cards'
    
    // Filter activities by type
    const habits = this.activities.filter(activity => activity.type === 'habit')
    const quits = this.activities.filter(activity => activity.type === 'quit')

    // Update tab counts
    habitsCount.textContent = habits.length
    quitsCount.textContent = quits.length
    logsCount.textContent = this.todayEvents.length

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
      if (gridContainer) gridContainer.style.display = 'none'
      if (tableContainer) tableContainer.style.display = 'none'
      if (noActivities) noActivities.style.display = 'block'
      return
    }

    if (noActivities) noActivities.style.display = 'none'

    // Apply saved order before rendering
    const orderedActivities = this.applySavedOrder(type, activities)

    if (this.currentView === 'table') {
      // Show table view
      if (gridContainer) gridContainer.style.display = 'none'
      if (tableContainer) {
        tableContainer.style.display = 'block'
        this.renderActivityTable(tableContainer, orderedActivities)
      }
    } else {
      // Show card view
      if (gridContainer) {
        gridContainer.style.display = 'grid'
        gridContainer.innerHTML = orderedActivities.map(activity => this.renderActivityCard(activity)).join('')
        this.addActivityCardContainerListeners(gridContainer)
      }
      if (tableContainer) tableContainer.style.display = 'none'
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

    container.querySelectorAll('.habit-week-day').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        const date = btn.dataset.date
        const activity = this.activities.find(a => a.id === activityId)
        if (!activity) return

        if (activity.allow_multiple_entries_per_day) {
          const decrement = e.metaKey || e.ctrlKey || e.altKey
          const delta = decrement ? -1 : 1
          this.handleHabitDayAdjust(activityId, date, delta, btn)
        } else {
          const nextState = btn.dataset.completed !== 'true'
          this.handleHabitDayToggle(activityId, date, nextState, btn)
        }
      })

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const activityId = btn.dataset.activityId
        const date = btn.dataset.date
        const activity = this.activities.find(a => a.id === activityId)
        if (!activity || !activity.allow_multiple_entries_per_day) return

        this.handleHabitDayAdjust(activityId, date, -1, btn)
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

    // Store touch state at container level to avoid conflicts
    if (!container._dragState) {
      container._dragState = {
        pointerId: null,
        draggedCard: null,
        lastTarget: null,
        originalTouchAction: null,
        initialX: 0,
        initialY: 0,
        currentX: 0,
        currentY: 0,
        clone: null
      }
    }
    const touchState = container._dragState

    const cleanupTouchDrag = () => {
      if (!touchState.draggedCard) return

      const activeCard = touchState.draggedCard

      if (touchState.pointerId !== null && typeof activeCard.releasePointerCapture === 'function') {
        try {
          activeCard.releasePointerCapture(touchState.pointerId)
        } catch (err) {
          // Ignore release failures; some browsers throw if capture was not set
        }
      }

      // Remove clone if it exists
      if (touchState.clone && touchState.clone.parentNode) {
        touchState.clone.parentNode.removeChild(touchState.clone)
      }

      activeCard.classList.remove('dragging')
      activeCard.style.pointerEvents = ''
      if (touchState.originalTouchAction !== null) {
        activeCard.style.touchAction = touchState.originalTouchAction
      } else {
        activeCard.style.touchAction = ''
      }
      container.classList.remove('dragging')
      container.querySelectorAll('.activity-card').forEach(c => c.classList.remove('drag-over'))

      touchState.pointerId = null
      touchState.draggedCard = null
      touchState.lastTarget = null
      touchState.originalTouchAction = null
      touchState.clone = null
    }
    
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

      // Use touch events for mobile (more reliable than pointer events on some devices)
      const handleTouchStart = (e) => {
        // Only handle single touch
        if (!e.touches || e.touches.length !== 1) return

        // Prevent if already dragging
        if (touchState.draggedCard) return

        const touch = e.touches[0]
        e.preventDefault()

        touchState.pointerId = touch.identifier
        touchState.draggedCard = card
        touchState.lastTarget = null
        touchState.initialX = touch.clientX
        touchState.initialY = touch.clientY
        touchState.originalTouchAction = card.style.touchAction || null

        // Disable touch scrolling and make element "invisible" to touch events
        card.style.touchAction = 'none'
        card.style.pointerEvents = 'none'
        card.classList.add('dragging')
        container.classList.add('dragging')
        container.querySelectorAll('.activity-card').forEach(c => c.classList.remove('drag-over'))
      }

      const handleTouchMove = (e) => {
        if (!touchState.draggedCard || touchState.draggedCard !== card) return

        const touch = Array.from(e.touches || []).find(t => t.identifier === touchState.pointerId)
        if (!touch) return

        e.preventDefault()
        e.stopPropagation()

        // Hide the dragged element temporarily to find what's underneath
        touchState.draggedCard.style.visibility = 'hidden'
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY)
        touchState.draggedCard.style.visibility = ''

        if (!targetElement) return

        const targetCard = targetElement.closest('.activity-card')
        if (!targetCard || targetCard === touchState.draggedCard || targetCard.parentElement !== container) return

        if (touchState.lastTarget !== targetCard) {
          this.reorderCards(container, touchState.draggedCard, targetCard)
          touchState.lastTarget = targetCard
        }
      }

      const handleTouchEnd = (e) => {
        if (!touchState.draggedCard || touchState.draggedCard !== card) return

        // Check if this touch is ending
        const remainingTouch = Array.from(e.touches || []).find(t => t.identifier === touchState.pointerId)
        if (remainingTouch) return

        e.preventDefault()
        cleanupTouchDrag()
      }

      // Add touch listeners
      card.addEventListener('touchstart', handleTouchStart, { passive: false })
      card.addEventListener('touchmove', handleTouchMove, { passive: false })
      card.addEventListener('touchend', handleTouchEnd, { passive: false })
      card.addEventListener('touchcancel', handleTouchEnd, { passive: false })

      // Also support pointer events for devices that use them
      if (typeof window !== 'undefined' && window.PointerEvent) {
        const handlePointerDown = (e) => {
          if (e.pointerType !== 'touch') return

          // Convert to touch-like event and use touch handlers
          const fakeTouch = {
            touches: [{
              identifier: e.pointerId,
              clientX: e.clientX,
              clientY: e.clientY
            }],
            preventDefault: () => e.preventDefault(),
            stopPropagation: () => e.stopPropagation()
          }
          handleTouchStart(fakeTouch)
        }

        const handlePointerMove = (e) => {
          if (e.pointerType !== 'touch' || !touchState.draggedCard) return

          const fakeTouch = {
            touches: [{
              identifier: touchState.pointerId,
              clientX: e.clientX,
              clientY: e.clientY
            }],
            preventDefault: () => e.preventDefault(),
            stopPropagation: () => e.stopPropagation()
          }
          handleTouchMove(fakeTouch)
        }

        const handlePointerEnd = (e) => {
          if (e.pointerType !== 'touch' || !touchState.draggedCard) return

          const fakeTouch = {
            touches: [],
            preventDefault: () => e.preventDefault()
          }
          handleTouchEnd(fakeTouch)
        }

        card.addEventListener('pointerdown', handlePointerDown, { passive: false })
        card.addEventListener('pointermove', handlePointerMove, { passive: false })
        card.addEventListener('pointerup', handlePointerEnd, { passive: false })
        card.addEventListener('pointercancel', handlePointerEnd, { passive: false })
      }
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
      option.addEventListener('click', this.handleGoalOptionClick.bind(this))
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

  addCalendarDayListeners(container) {
    console.log('🔍 DEBUG: addCalendarDayListeners called')
    // Calendar day click handlers for showing day entries
    const clickableDays = container.querySelectorAll('.clickable-day')
    console.log('🔍 DEBUG: Found', clickableDays.length, 'clickable days')

    const activityId = this.currentCalendarActivity
    const activity = this.activities.find(a => a.id === activityId)

    clickableDays.forEach((day, index) => {
      // Since we replace the HTML in updateFullScreenCalendar, we always need to add listeners
      // to the new elements.

      // Add listener
      day.addEventListener('click', (e) => {
        e.stopPropagation()  // Prevent event bubbling
        console.log('🔍 DEBUG: Calendar day clicked:', day.dataset.date, 'by listener', index)
        const date = day.dataset.date
        const dateString = day.dataset.dateString
        const currentActivityId = this.currentCalendarActivity
        if (activity && activity.type === 'quit') {
          this.showRetroactiveSlipupModal(currentActivityId, date)
        } else {
          this.showDayEntriesModal(currentActivityId, date, dateString)
        }
      })
    })
  }

  showDayEntriesModal(activityId, date, dateString) {
    const modal = document.getElementById('day-entries-modal')
    const dateSpan = document.getElementById('day-entries-date')
    const entriesList = document.getElementById('day-entries-list')

    if (!modal) return

    // Set the date in the title
    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    dateSpan.textContent = displayDate

    // Get events for this date from our stored map
    const events = this.currentMonthEvents?.get(dateString) || []

    // Render the entries
    if (events.length === 0) {
      entriesList.innerHTML = '<div class="no-entries-message">No entries for this date. Click "Add New Entry" to log one.</div>'
    } else {
      entriesList.innerHTML = events.map(event => {
        const eventTime = new Date(event.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
        return `
          <div class="day-entry-item" data-event-id="${event.id}">
            <div>
              <div class="day-entry-time">${eventTime}</div>
              ${event.note ? `<div class="day-entry-note">${event.note}</div>` : ''}
            </div>
            <button class="day-entry-delete" data-event-id="${event.id}">Delete</button>
          </div>
        `
      }).join('')
    }

    // Add delete button listeners
    entriesList.querySelectorAll('.day-entry-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const eventId = btn.dataset.eventId
        await this.handleDeleteEvent(eventId, activityId, date)
      })
    })

    // Store current date and activityId for add new entry
    modal.dataset.currentDate = date
    modal.dataset.activityId = activityId
    modal.dataset.dateString = dateString

    // Enable/disable Add New Entry based on habit multi setting
    const activity = this.activities.find(a => a.id === activityId)
    const addBtn = document.getElementById('add-new-entry-btn')
    if (addBtn && activity) {
      const isMulti = Boolean(activity.allow_multiple_entries_per_day)
      const hasEntry = (events.length > 0)
      addBtn.disabled = !isMulti && hasEntry
      addBtn.textContent = (!isMulti && hasEntry) ? 'Already logged' : 'Add New Entry'
    }

    // Show modal
    modal.style.display = 'flex'
  }

  hideDayEntriesModal() {
    const modal = document.getElementById('day-entries-modal')
    if (modal) {
      modal.style.display = 'none'
      delete modal.dataset.currentDate
      delete modal.dataset.activityId
      delete modal.dataset.dateString
    }
  }

  showSettingsModal() {
    const modal = document.getElementById('settings-modal')
    if (modal) {
      // Hide the header dropdown first
      const dropdown = document.getElementById('header-dropdown')
      if (dropdown) dropdown.style.display = 'none'

      // Load current user info
      this.loadSettingsData()

      // Show the modal
      modal.style.display = 'flex'
    }
  }

  hideSettingsModal() {
    const modal = document.getElementById('settings-modal')
    if (modal) {
      modal.style.display = 'none'
    }
  }

  showThemeCreator() {
    const modal = document.getElementById('theme-creator-modal')
    if (modal) {
      modal.style.display = 'flex'
      // Load current theme colors as defaults
      this.loadCurrentThemeColors()
    }
  }

  hideThemeCreator() {
    const modal = document.getElementById('theme-creator-modal')
    if (modal) {
      modal.style.display = 'none'
      // Revert any preview changes
      if (this.previewingTheme) {
        this.applyTheme(this.selectedTheme || 'light')
        this.previewingTheme = false
      }
    }
  }

  loadCurrentThemeColors() {
    const computedStyle = getComputedStyle(document.documentElement)
    const colorMappings = {
      'bg-primary': '--bg-primary',
      'bg-secondary': '--bg-secondary',
      'bg-tertiary': '--bg-tertiary',
      'text-primary': '--text-primary',
      'text-secondary': '--text-secondary',
      'text-muted': '--text-muted',
      'primary': '--primary',
      'success': '--success',
      'danger': '--danger',
      'border': '--border',
      'gradient-start': '--gradient-start',
      'gradient-end': '--gradient-end'
    }

    for (const [inputId, cssVar] of Object.entries(colorMappings)) {
      const color = computedStyle.getPropertyValue(cssVar).trim()
      const colorInput = document.getElementById(`color-${inputId}`)
      const textInput = document.getElementById(`text-${inputId}`)

      if (colorInput && textInput && color) {
        // Convert to hex if needed
        const hexColor = this.cssColorToHex(color)
        colorInput.value = hexColor
        textInput.value = hexColor
      }
    }
  }

  cssColorToHex(color) {
    // If already hex, return as is
    if (color.startsWith('#')) {
      return color
    }

    // Convert rgb/rgba to hex
    const canvas = document.createElement('canvas')
    canvas.height = 1
    canvas.width = 1
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
  }

  setupColorInputSync() {
    const colorInputs = document.querySelectorAll('input[type="color"]')
    colorInputs.forEach(colorInput => {
      const inputId = colorInput.id.replace('color-', 'text-')
      const textInput = document.getElementById(inputId)

      if (textInput) {
        // Sync color picker to text input
        colorInput.addEventListener('input', (e) => {
          textInput.value = e.target.value
        })

        // Sync text input to color picker
        textInput.addEventListener('input', (e) => {
          const value = e.target.value
          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            colorInput.value = value
          }
        })
      }
    })
  }

  previewCustomTheme() {
    const themeColors = this.getThemeColorsFromInputs()

    // Apply the colors as CSS variables
    const root = document.documentElement
    for (const [key, value] of Object.entries(themeColors)) {
      root.style.setProperty(`--${key}`, value)
    }

    this.previewingTheme = true
    this.showMessage('Preview applied! Click "Save Theme" to keep it or "Cancel" to revert.', 'info')
  }

  getThemeColorsFromInputs() {
    const colorMappings = {
      'bg-primary': 'bg-primary',
      'bg-secondary': 'bg-secondary',
      'bg-tertiary': 'bg-tertiary',
      'text-primary': 'text-primary',
      'text-secondary': 'text-secondary',
      'text-muted': 'text-muted',
      'primary': 'primary',
      'primary-hover': 'primary', // Use same as primary for now
      'success': 'success',
      'warning': 'success', // Use success color for warning
      'danger': 'danger',
      'border': 'border',
      'border-light': 'border', // Use same as border
      'shadow': 'rgba(0, 0, 0, 0.1)',
      'habit-color': 'success',
      'quit-color': 'danger',
      'gradient-start': 'gradient-start',
      'gradient-end': 'gradient-end'
    }

    const colors = {}
    for (const [cssVar, inputId] of Object.entries(colorMappings)) {
      if (inputId.includes('rgba')) {
        colors[cssVar] = inputId
      } else {
        const textInput = document.getElementById(`text-${inputId}`)
        if (textInput) {
          colors[cssVar] = textInput.value
        }
      }
    }

    return colors
  }

  async saveCustomTheme() {
    const themeName = document.getElementById('theme-name').value.trim()

    if (!themeName) {
      this.showMessage('Please enter a theme name', 'error')
      return
    }

    const themeColors = this.getThemeColorsFromInputs()

    try {
      // Save the theme to the backend
      await api.createTheme({
        name: themeName,
        colors: themeColors
      })

      // Add to theme selector
      await this.loadCustomThemes()

      // Apply the theme
      this.applyTheme(themeName)
      this.selectedTheme = themeName

      // Update theme selector
      const themeSelect = document.getElementById('theme-select')
      if (themeSelect) {
        // Add the new theme if not exists
        let optionExists = false
        for (let option of themeSelect.options) {
          if (option.value === themeName) {
            optionExists = true
            break
          }
        }

        if (!optionExists) {
          const option = document.createElement('option')
          option.value = themeName
          option.textContent = themeName
          themeSelect.appendChild(option)
        }

        themeSelect.value = themeName
      }

      // Save preference
      await api.updatePreferences({ selectedTheme: themeName })

      this.showMessage('Theme saved successfully!', 'success')
      this.hideThemeCreator()
      this.previewingTheme = false

    } catch (error) {
      console.error('Failed to save theme:', error)
      this.showMessage('Failed to save theme', 'error')
    }
  }

  async loadCustomThemes() {
    try {
      const response = await api.getThemes()
      if (response && response.themes) {
        const themeSelect = document.getElementById('theme-select')
        if (themeSelect) {
          // Remove existing custom themes
          const customOptions = Array.from(themeSelect.options).filter(
            opt => !['light', 'dark', 'ocean'].includes(opt.value)
          )
          customOptions.forEach(opt => opt.remove())

          // Add custom themes
          response.themes.forEach(theme => {
            if (!theme.is_built_in) {
              const option = document.createElement('option')
              option.value = theme.name
              option.textContent = theme.name
              themeSelect.appendChild(option)
            }
          })
        }

        // Store themes for later use
        this.customThemes = response.themes.filter(t => !t.is_built_in)
      }
    } catch (error) {
      console.error('Failed to load custom themes:', error)
    }
  }

  async loadSettingsData() {
    try {
      // Load custom themes
      await this.loadCustomThemes()

      // Get current user info
      const response = await api.getCurrentUser()
      if (response && response.user) {
        const user = response.user

        const usernameElement = document.getElementById('settings-username')
        if (usernameElement) {
          usernameElement.textContent = user.username
        }

        // Load default abstinence text
        const abstinenceTextInput = document.getElementById('default-abstinence-text')
        if (abstinenceTextInput) {
          abstinenceTextInput.value = user.default_abstinence_text || 'Abstinence time'
        }

        // Load custom title
        const titleInput = document.getElementById('custom-title')
        if (titleInput) {
          titleInput.value = user.custom_title || 'Habit Tracker'
        }

        // Load title visibility
        const titleCheckbox = document.getElementById('show-title-section')
        if (titleCheckbox) {
          titleCheckbox.checked = user.show_title_section !== false
        }

        const density = user.card_density || 'comfy'
        document.querySelectorAll('input[name="card-density"]').forEach(radio => {
          radio.checked = radio.value === density
        })
        if (this.currentUser) {
          this.currentUser.card_density = density
          this.applyCardDensity()
        }

        // Load tab visibility settings
        const habitsCheckbox = document.getElementById('show-habits-tab')
        const quitsCheckbox = document.getElementById('show-quits-tab')
        const logsCheckbox = document.getElementById('show-logs-tab')

        if (habitsCheckbox) habitsCheckbox.checked = user.show_habits_tab !== false
        if (quitsCheckbox) quitsCheckbox.checked = user.show_quits_tab !== false
        if (logsCheckbox) logsCheckbox.checked = user.show_logs_tab !== false

        // Load selected theme
        const themeSelect = document.getElementById('theme-select')
        if (themeSelect) {
          themeSelect.value = user.selected_theme || 'light'
        }

        // Store for later use
        this.userDefaultAbstinenceText = user.default_abstinence_text || 'Abstinence time'

        // Show admin settings if user is admin
        if (user.is_admin) {
          const adminSection = document.getElementById('admin-settings-section')
          if (adminSection) {
            adminSection.style.display = 'block'
          }

          // Load system settings
          try {
            const settingsResponse = await api.getSystemSettings()
            if (settingsResponse && settingsResponse.settings) {
              const signupCheckbox = document.getElementById('disable-signup')
              if (signupCheckbox) {
                signupCheckbox.checked = settingsResponse.settings.signup_disabled === 'true'
              }
            }
          } catch (error) {
            console.error('Error loading system settings:', error)
          }
        }
      }

      // Load API keys
      await this.loadApiKeys()
    } catch (error) {
      console.error('Error loading settings data:', error)
    }
  }

  async loadApiKeys() {
    try {
      const response = await api.getApiKeys()
      const keysListElement = document.getElementById('api-keys-list')

      if (!keysListElement) return

      if (response.keys && response.keys.length > 0) {
        keysListElement.innerHTML = response.keys.map(key => `
          <div class="api-key-item">
            <div class="api-key-info">
              <div class="api-key-name">${key.name}</div>
              <div class="api-key-date">
                Created: ${new Date(key.created_at).toLocaleDateString()}
                ${key.last_used ? ` • Last used: ${new Date(key.last_used).toLocaleDateString()}` : ''}
              </div>
            </div>
            <button class="btn btn-danger btn-sm delete-api-key" data-key-id="${key.id}">Delete</button>
          </div>
        `).join('')

        // Add delete event listeners
        keysListElement.querySelectorAll('.delete-api-key').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            if (confirm('Are you sure you want to delete this API key?')) {
              await this.deleteApiKey(e.target.dataset.keyId)
            }
          })
        })
      } else {
        keysListElement.innerHTML = '<p style="color: #6c757d; padding: 10px;">No API keys yet</p>'
      }
    } catch (error) {
      console.error('Error loading API keys:', error)
    }
  }

  async createApiKey() {
    const name = prompt('Enter a name for this API key:')
    if (!name) return

    try {
      const response = await api.createApiKey(name)

      if (response.apiKey) {
        // Show the key in a modal
        const modal = document.getElementById('api-key-modal')
        const keyValue = document.getElementById('api-key-value')

        if (modal && keyValue) {
          keyValue.textContent = response.apiKey.apiKey
          modal.style.display = 'flex'
        }

        // Reload the API keys list
        await this.loadApiKeys()
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      this.showMessage('Failed to create API key', 'error')
    }
  }

  async deleteApiKey(keyId) {
    try {
      await api.deleteApiKey(keyId)
      await this.loadApiKeys()
      this.showMessage('API key deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting API key:', error)
      this.showMessage('Failed to delete API key', 'error')
    }
  }

  showApiDocs() {
    const modal = document.getElementById('api-docs-modal')
    const baseUrlElement = document.getElementById('api-base-url')

    if (modal && baseUrlElement) {
      // Set the base URL to the current site
      baseUrlElement.textContent = window.location.origin

      // Show the modal
      modal.style.display = 'flex'
    }
  }

  async handleDeleteEvent(eventId, activityId, date) {
    if (!confirm('Are you sure you want to delete this entry?')) return

    try {
      await api.deleteEvent(eventId)
      this.showMessage('Entry deleted successfully', 'success')

      // Refresh the calendar
      const currentDate = new Date()
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const eventsResponse = await api.getEventsInDateRange(
        activityId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )

      const tabContent = document.querySelector('.fullscreen-calendar-view')
      if (tabContent) {
        this.updateFullScreenCalendar(tabContent, currentDate, eventsResponse.events || [])
      }

      // Refresh the day entries modal
      const modal = document.getElementById('day-entries-modal')
      if (modal && modal.style.display !== 'none') {
        const dateString = modal.dataset.dateString
        this.showDayEntriesModal(activityId, date, dateString)
      }

      // Refresh statistics for the activity so streaks update live
      try {
        const statsResponse = await api.getActivityStats(activityId)
        const activity = this.activities.find(a => a.id === activityId)
        if (activity) {
          activity.statistics = statsResponse.statistics
        }
        // Re-render habits tab to reflect updated streaks
        this.renderActivitiesInTab('habits')
      } catch (statsErr) {
        console.error('Failed to refresh stats after deletion:', statsErr)
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      this.showMessage('Failed to delete entry', 'error')
    }
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

  showGoalSelection(activityId) {
    this.toggleGoalDropdown(activityId)
    
    // Add goal option listeners for regular cards (similar to calendar)
    const dropdown = document.getElementById(`goal-dropdown-${activityId}`)
    if (dropdown) {
      // Goal option click handlers  
      dropdown.querySelectorAll('.goal-option').forEach(option => {
        // Remove existing listeners to avoid duplicates
        option.removeEventListener('click', this.handleGoalOptionClick)
        
        // Add new listener
        option.addEventListener('click', this.handleGoalOptionClick.bind(this))
      })
    }
  }

  handleGoalOptionClick(e) {
    const option = e.currentTarget
    
    // Don't allow selection of completed/disabled goals
    if (option.classList.contains('disabled')) {
      return
    }
    
    const goal = option.dataset.goal
    const hours = parseInt(option.dataset.hours)
    const activityId = option.closest('.progress-circle-container').dataset.activityId || 
                      option.closest('[data-activity-id]').dataset.activityId
    
    this.selectGoal(activityId, goal, hours)
  }

  cycleView() {
    const views = ['cards', 'table']
    const currentIndex = views.indexOf(this.currentView)
    const nextIndex = (currentIndex + 1) % views.length
    const nextView = views[nextIndex]
    
    this.switchView(nextView)
    
    // Update button icon based on current view
    const button = document.querySelector('.view-toggle-btn')
    if (button) {
      const icons = {
        'cards': '⊞',
        'table': '☰'
      }
      button.innerHTML = icons[nextView] || '⊞'
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
      
      // Update the display in card view
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

      // Update calendar view if it's currently showing this activity
      if (this.currentCalendarActivity === activityId) {
        const calendarProgressPercent = document.querySelector('.fullscreen-calendar-view .progress-percent')
        const calendarProgressGoal = document.querySelector('.fullscreen-calendar-view .progress-goal')
        const calendarProgressCircle = document.querySelector('.fullscreen-calendar-view circle[stroke-dasharray]')
        
        if (calendarProgressPercent) calendarProgressPercent.textContent = `${timeData.progressPercent.toFixed(1)}%`
        if (calendarProgressGoal) calendarProgressGoal.textContent = timeData.currentGoal
        if (calendarProgressCircle) {
          const circumference = 2 * Math.PI * (calendarProgressCircle.getAttribute('r') || 50)
          calendarProgressCircle.style.strokeDashoffset = circumference * (1 - timeData.progressPercent / 100)
        }
      }

      // Hide both regular and calendar dropdowns
      this.hideGoalDropdown(activityId)
      this.hideCalendarGoalDropdown(activityId)
    } catch (error) {
      console.error('Error updating goal:', error)
      console.error('Error details:', error.message, error.stack)
      this.showMessage(`Failed to update goal: ${error.message}`, 'error')
    }
  }

  calculateTimeDisplayWithGoal(activity, lastEvent, goalHours, goalName) {
    const baseTimeData = this.calculateTimeDisplay(activity, lastEvent)

    // Define milestone goals (in hours) - same as in renderGoalOptions
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

    let currentGoal = goalName || goals[0].name
    let currentGoalHours = goalHours || goals[0].hours

    // If no goal was set, or if current goal is reached, find appropriate goal
    if (!goalHours || baseTimeData.totalHours >= goalHours) {
      // Find the appropriate goal based on current hours
      for (let i = 0; i < goals.length; i++) {
        const goal = goals[i]
        if (baseTimeData.totalHours < goal.hours) {
          currentGoal = goal.name
          currentGoalHours = goal.hours

          // Update the activity's selected goal in memory
          activity.selectedGoal = { name: goal.name, hours: goal.hours }

          // Update in database asynchronously (don't wait for it)
          api.updateActivityGoal(activity.id, goal.name, goal.hours).catch(error => {
            console.error('Error auto-updating goal:', error)
          })
          break
        } else if (i === goals.length - 1) {
          // Exceeded all goals - stay at the highest one
          currentGoal = goal.name
          currentGoalHours = goal.hours
          activity.selectedGoal = { name: goal.name, hours: goal.hours }
        }
      }
    }

    const progressPercent = Math.min((baseTimeData.totalHours / currentGoalHours) * 100, 100)

    return {
      ...baseTimeData,
      progressPercent,
      currentGoal
    }
  }

  renderActivityCard(activity) {
    const lastEvent = activity.lastEvent
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
        
        ${activity.type === 'quit' ? this.renderQuitDisplay(timeData, activity.color, activity.id, activity.icon, activity.abstinence_text) : this.renderHabitDisplay(activity)}

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
        hasProgress: false,
        totalHours: 0
      }
    }

    const now = new Date()
    const diffMs = now - startDate

    // Convert to different units
    const totalSeconds = Math.floor(diffMs / 1000)
    const totalMinutes = Math.floor(totalSeconds / 60)
    const totalHoursExact = totalMinutes / 60  // Keep fractional hours for accurate progress
    const totalHours = Math.floor(totalHoursExact)
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

    // Find current goal - default to first goal if starting fresh
    let currentGoal = goals[0] // Default to first goal (24 Hours)
    let progressPercent = 0

    // Find the appropriate goal based on current progress (use exact hours for accuracy)
    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i]
      if (totalHoursExact < goal.hours) {
        currentGoal = goal
        progressPercent = (totalHoursExact / goal.hours) * 100
        break
      } else if (i === goals.length - 1) {
        // Achieved the highest goal
        currentGoal = goal
        progressPercent = 100
      }
    }

    return {
      timeString,
      progressPercent: Math.min(progressPercent, 100),
      currentGoal: currentGoal.name,
      hasProgress: totalHoursExact > 0,
      totalHours: totalHoursExact,  // Return the exact hours for other calculations
      days,
      hours,
      minutes,
      seconds
    }
  }

  renderQuitDisplay(timeData, color, activityId, icon, abstinenceText) {
    const progressColor = color || '#ef4444'
    const buttonIcon = icon || '⚠️'
    const displayText = abstinenceText || 'Abstinence time'

    return `
      <div class="quit-display-modern">
        <div class="quit-content">
          <div class="quit-left">
            <div class="abstinence-label">${displayText}</div>
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
        <div class="goal-option ${isCompleted ? 'completed disabled' : ''}" data-goal="${goal.name}" data-hours="${goal.hours}">
          <div class="goal-info">
            <span class="goal-name">${goal.name}</span>
            <span class="goal-progress">${progressPercent.toFixed(1)}%</span>
          </div>
          ${isCompleted ? '<span class="goal-check">✓</span>' : ''}
        </div>
      `
    }).join('')
  }

  renderHabitDisplay(activity) {
    const stats = activity.statistics || {}
    const weeklyLog = activity.weekly_log
    const hasWeeklyLog = weeklyLog && Array.isArray(weeklyLog.days) && weeklyLog.days.length > 0

    const weeklyMarkup = hasWeeklyLog
      ? `
        <div class="habit-weekly" aria-label="Weekly progress">
          <div class="habit-week-days">
            ${weeklyLog.days.map(day => this.renderHabitWeekDay(activity, day)).join('')}
          </div>
        </div>
      `
      : ''

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
        ${weeklyMarkup}
      </div>
    `
  }

  renderHabitWeekDay(activity, day) {
    const label = this.getShortWeekdayLabel(day.date)
    const isToday = this.isToday(day.date)
    const classes = ['habit-week-day']
    if (day.completed) classes.push('completed')
    if (isToday) classes.push('today')

    const count = typeof day.count === 'number' ? day.count : 0
    const isMulti = Boolean(activity.allow_multiple_entries_per_day)
    const statusText = day.completed ? 'completed' : 'not completed'
    const countText = isMulti && count > 0 ? `x${count}` : ''
    const ariaLabel = isMulti
      ? `${label} ${statusText}, ${count} entr${count === 1 ? 'y' : 'ies'}`
      : `${label} ${statusText}`
    const titleText = isMulti
      ? `${label}: tap to add, Alt/⌘/Ctrl-click to remove`
      : label

    return `
      <button
        type="button"
        class="${classes.join(' ')}"
        data-activity-id="${activity.id}"
        data-date="${day.date}"
        data-completed="${day.completed}"
        data-count="${count}"
        data-multi="${isMulti}"
        aria-pressed="${day.completed}"
        aria-label="${ariaLabel}"
        title="${titleText}"
      >
        <span class="habit-week-day-label">${label.charAt(0)}</span>
        <span class="habit-week-day-count">${countText}</span>
      </button>
    `
  }

  renderTodayEvents() {
    const container = document.getElementById('today-events')
    
    // Skip rendering if container doesn't exist (e.g., in calendar view)
    if (!container) return
    
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

  getLocalDateString(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  getShortWeekdayLabel(dateString) {
    const date = new Date(`${dateString}T00:00:00`)
    if (Number.isNaN(date.getTime())) {
      return dateString
    }
    return date.toLocaleDateString(undefined, { weekday: 'short' })
  }

  isToday(dateString) {
    return this.getLocalDateString(new Date()) === dateString
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
